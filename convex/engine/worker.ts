import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { LIBRARIAN_PROMPT, RESEARCHER_PROMPT, WRITER_PROMPT } from "../../src/shared/agents";
import type { UsableApp } from "../../src/shared/apps";
import {
  APP_WRITES_MAX,
  RESULT_URLS_MAX,
  TOOL_CALL_TIMEOUT_MS,
  WORKER_DEADLINE_MS,
  WORKER_MAX_STEPS,
  WORKER_MAX_TOOL_CALLS,
} from "../../src/shared/constants";
import { preview, type Source, type ToolName } from "../../src/shared/events";
import { emit, errorMessage, previewWithArtifact, saveArtifact } from "./emit";
import { BudgetSignal, StopSignal, callGate, withTimeout } from "./gate";
import { loadLlmClient } from "./llm/client";
import { LlmError, type LlmMessage, type ToolCallRequest } from "./llm/types";
import { LiveText } from "./liveText";
import { dedupeSources, summarize, taskPrompt } from "./prompts";
import { runAppTool, runTool, toolInputSchemas, toolsForTask, type ToolOutcome, type WriteSectionInput } from "./tools/registry";

// A worker (tech spec §7.4): 8 model steps and 6 tool calls at most. It stops
// when it calls write_section, when the model makes no tool call, or when the
// budget is empty. Tool errors go back to the model as data.

const KNOWN_TOOLS = new Set<string>(["web_search", "fetch_url", "write_section", "app_search", "app_write"]);
const APP_TOOLS = new Set<string>(["app_search", "app_write"]);

type ToolResultMessage = { id: string; name: string; output: string; isError: boolean };

export const run = internalAction({
  args: { missionId: v.id("missions"), nodeId: v.string() },
  handler: async (ctx, { missionId, nodeId }): Promise<{ ok: boolean }> => {
    const startedAt = Date.now();
    const context = await ctx.runQuery(internal.engine.state.workerContext, { missionId, nodeId });
    if (!context || context.stopped) return { ok: false };
    if (context.node.status === "done") return { ok: true };
    if (context.node.status === "killed" || context.node.role === "revision") return { ok: false };

    const role = context.node.role;
    const agentRole = role === "writer" ? "writer" : role === "librarian" ? "librarian" : "researcher";
    const attempt = context.node.attempt + 1;
    let client;
    try {
      client = await loadLlmClient(ctx, context.mode, context.modelProfile);
    } catch (error) {
      await emit(ctx, missionId, [
        { type: "node_failed", nodeId, payload: { error: errorMessage(error), retryable: false, attempt } },
      ]);
      return { ok: false };
    }
    const model = client.modelFor(agentRole);
    const live = new LiveText(ctx, missionId, nodeId);
    const seed = `${missionId}:${nodeId}:${attempt}`;
    const sim = {
      seed,
      goal: context.goal,
      task: { id: nodeId, role, title: context.node.title, instructions: context.node.instructions },
      inputs: context.dependencies
        .filter((dep) => dep.status === "done")
        .map((dep) => ({ title: dep.title, markdown: dep.markdown, sources: dep.sources })),
      apps: context.apps,
    };

    await emit(ctx, missionId, [{ type: "node_started", nodeId, payload: { attempt, model } }]);

    const messages: LlmMessage[] = [
      {
        role: "user",
        content: taskPrompt({
          goal: context.goal,
          title: context.node.title,
          instructions: context.node.instructions,
          dependencies: context.dependencies,
          apps: context.apps,
        }),
      },
    ];
    let toolCallsUsed = 0;
    let writesUsed = 0;
    let section: WriteSectionInput | null = null;
    let lastText = "";
    const seenSources: Source[] = [];

    try {
      for (let step = 1; step <= WORKER_MAX_STEPS && !section; step += 1) {
        // Keep the action far below the 10-minute limit: write with what we have.
        if (Date.now() - startedAt > WORKER_DEADLINE_MS) break;

        live.reset();
        const lastStep = step === WORKER_MAX_STEPS;
        const tools = toolsForTask(role, lastStep ? 0 : WORKER_MAX_TOOL_CALLS - toolCallsUsed, {
          apps: context.apps,
          writesLeft: APP_WRITES_MAX - writesUsed,
        });
        const system = role === "writer" ? WRITER_PROMPT : role === "librarian" ? LIBRARIAN_PROMPT : RESEARCHER_PROMPT;
        let result;
        try {
          result = await client.step({
            role: agentRole,
            // Each worker keeps one call of the budget free for the assembler.
            acquire: callGate(ctx, { missionId, nodeId, attempt, model, keep: 1 }),
            system,
            messages,
            tools,
            onDelta: live.push,
            sim,
          });
        } catch (error) {
          // An empty budget ends the loop: the section uses the work so far (FR-16).
          if (error instanceof BudgetSignal) break;
          throw error;
        }
        await live.flush();
        if (result.text.trim()) lastText = result.text.trim();

        await emit(ctx, missionId, [
          { type: "thought", nodeId, payload: { step, text: result.text.trim() } },
          {
            type: "llm_usage",
            nodeId,
            payload: {
              model: result.model,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              latencyMs: result.latencyMs,
            },
          },
        ]);

        messages.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });
        if (result.toolCalls.length === 0) break;

        const allowedNames = new Set(tools.map((tool) => tool.name));
        const results: ToolResultMessage[] = [];
        for (const call of result.toolCalls) {
          if (section) {
            results.push({ id: call.id, name: call.name, output: "Skipped: the section is already written.", isError: true });
            continue;
          }
          const outcome = await runToolCall(ctx, {
            missionId,
            nodeId,
            call,
            allowed: allowedNames,
            toolCallsLeft: WORKER_MAX_TOOL_CALLS - toolCallsUsed,
            mode: context.mode,
            seed,
            focusFallback: context.node.instructions,
            userId: context.userId,
            apps: context.apps,
            writesLeft: APP_WRITES_MAX - writesUsed,
          });
          if (outcome.countsAsCall) toolCallsUsed += 1;
          if (outcome.wrote) writesUsed += 1;
          if (outcome.section) section = outcome.section;
          seenSources.push(...outcome.sources);
          results.push({ id: call.id, name: call.name, output: outcome.output, isError: !outcome.ok });
        }
        messages.push({ role: "tool", results });
      }

      if (!section) {
        // Some models answer in plain text and never call write_section.
        if (lastText.length < 40) throw new Error("The agent did not write a section.");
        section = { title: context.node.title, markdown: lastText, sources: dedupeSources(seenSources).slice(0, 10) };
      }

      const outputArtifactId = await saveArtifact(ctx, { missionId, nodeId, kind: "node_output", text: section.markdown });
      await live.clear();
      await emit(ctx, missionId, [
        {
          type: "node_done",
          nodeId,
          payload: { summary: summarize(section.markdown), outputArtifactId, sources: dedupeSources(section.sources) },
        },
      ]);
      return { ok: true };
    } catch (error) {
      await live.clear();
      if (error instanceof StopSignal) return { ok: false };
      await emit(ctx, missionId, [
        {
          type: "node_failed",
          nodeId,
          payload: { error: errorMessage(error), retryable: error instanceof LlmError && error.retryable, attempt },
        },
      ]);
      return { ok: false };
    }
  },
});

type ToolCallOutcome = {
  ok: boolean;
  output: string;
  countsAsCall: boolean;
  /** An app_write that created an item. */
  wrote: boolean;
  section: WriteSectionInput | null;
  sources: Source[];
};

/** One tool call: tool_call event, run, tool_result event (tech spec §3.1 rule 3). */
async function runToolCall(
  ctx: ActionCtx,
  args: {
    missionId: Id<"missions">;
    nodeId: string;
    call: ToolCallRequest;
    allowed: Set<string>;
    toolCallsLeft: number;
    mode: "live" | "simulated";
    seed: string;
    focusFallback: string;
    userId: string;
    apps: readonly UsableApp[];
    writesLeft: number;
  },
): Promise<ToolCallOutcome> {
  const { missionId, nodeId, call } = args;
  if (!KNOWN_TOOLS.has(call.name)) {
    // A made-up tool name has no satellite. The error goes back to the model only.
    const error = `The tool "${call.name}" does not exist. Use one of: ${[...args.allowed].join(", ")}.`;
    return { ok: false, output: error, countsAsCall: false, wrote: false, section: null, sources: [] };
  }
  const tool = call.name as ToolName;
  const inputText = typeof call.input === "string" ? call.input : JSON.stringify(call.input ?? {}, null, 2);
  const input = await previewWithArtifact(ctx, { missionId, nodeId, kind: "tool_input", text: inputText });
  const callId = `${nodeId}#${call.id}`.slice(0, 200);

  await emit(ctx, missionId, [
    {
      type: "tool_call",
      nodeId,
      payload: { callId, tool, inputPreview: input.preview, ...(input.artifactId ? { inputArtifactId: input.artifactId } : {}) },
    },
  ]);

  const started = Date.now();
  let outcome: ToolOutcome;
  let section: WriteSectionInput | null = null;
  let countsAsCall = false;
  let wrote = false;

  if (!args.allowed.has(call.name)) {
    const error = `The tool "${call.name}" is not available now. Use one of: ${[...args.allowed].join(", ")}.`;
    outcome = { ok: false, output: error, fullText: "", error };
  } else if (call.name === "write_section") {
    const parsed = toolInputSchemas.write_section.safeParse(call.input);
    if (parsed.success) {
      section = parsed.data;
      outcome = { ok: true, output: "The section is saved. The task is complete.", fullText: "" };
    } else {
      const error = `The input is not valid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")}. Call write_section again with a valid input.`;
      outcome = { ok: false, output: error, fullText: "", error };
    }
  } else if (args.toolCallsLeft <= 0) {
    const error = "No tool calls are left. Call write_section now.";
    outcome = { ok: false, output: error, fullText: "", error };
  } else if (call.name === "app_write" && args.writesLeft <= 0) {
    const error = `No app writes are left: a task creates ${APP_WRITES_MAX} items or less. Call write_section now.`;
    outcome = { ok: false, output: error, fullText: "", error };
  } else if (APP_TOOLS.has(call.name)) {
    const name = call.name as "app_search" | "app_write";
    const parsed = toolInputSchemas[name].safeParse(call.input);
    if (!parsed.success) {
      const error = `The input is not valid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")}.`;
      outcome = { ok: false, output: error, fullText: "", error };
    } else {
      countsAsCall = true;
      try {
        outcome = await withTimeout(
          runAppTool(args.mode, name, parsed.data, {
            ctx,
            seed: args.seed,
            focusFallback: args.focusFallback,
            userId: args.userId,
            apps: args.apps,
          }),
          TOOL_CALL_TIMEOUT_MS,
          "The app did not answer in time.",
        );
      } catch (error) {
        const message = errorMessage(error);
        outcome = { ok: false, output: `Error: ${message}`, fullText: "", error: message };
      }
      wrote = name === "app_write" && outcome.ok;
    }
  } else {
    const name = call.name as "web_search" | "fetch_url";
    const parsed = toolInputSchemas[name].safeParse(call.input);
    if (!parsed.success) {
      const error = `The input is not valid: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ")}.`;
      outcome = { ok: false, output: error, fullText: "", error };
    } else {
      countsAsCall = true;
      try {
        outcome = await withTimeout(
          runTool(args.mode, name, parsed.data, { ctx, seed: args.seed, focusFallback: args.focusFallback }),
          TOOL_CALL_TIMEOUT_MS,
          "The tool did not answer in time.",
        );
      } catch (error) {
        const message = errorMessage(error);
        outcome = { ok: false, output: `Error: ${message}`, fullText: "", error: message };
      }
    }
  }

  const output = outcome.ok
    ? await previewWithArtifact(ctx, { missionId, nodeId, kind: "tool_output", text: outcome.fullText || outcome.output })
    : { preview: preview(outcome.error ?? outcome.output), artifactId: undefined };

  const sources = sourcesOf(call.name, outcome);
  await emit(ctx, missionId, [
    {
      type: "tool_result",
      nodeId,
      payload: {
        callId,
        ok: outcome.ok,
        outputPreview: output.preview,
        ...(output.artifactId ? { outputArtifactId: output.artifactId } : {}),
        durationMs: Math.round(Date.now() - started),
        ...(outcome.ok ? {} : { error: outcome.error ?? "The tool failed." }),
        ...(sources.length > 0 ? { urls: sources.slice(0, RESULT_URLS_MAX).map((source) => source.url) } : {}),
      },
    },
  ]);

  return { ok: outcome.ok, output: outcome.output, countsAsCall, wrote, section, sources };
}

/** Sources seen in tool results, for a section written as plain text. */
function sourcesOf(name: string, outcome: ToolOutcome): Source[] {
  if (!outcome.ok || !["web_search", "fetch_url", "app_search", "app_write"].includes(name)) return [];
  const found: Source[] = [];
  for (const match of outcome.fullText.matchAll(/^(?:\d+\. |Title: )(.+)\n\s*URL: (\S+)/gm)) {
    found.push({ title: match[1].trim(), url: match[2] });
  }
  return found;
}
