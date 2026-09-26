import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { ASSEMBLER_PROMPT, REVISION_PROMPT } from "../../src/shared/agents";
import { ASSEMBLER_ID } from "../../src/shared/plan";
import { emit, errorMessage, saveArtifact } from "./emit";
import { StopSignal, callGate } from "./gate";
import { loadLlmClient } from "./llm/client";
import { LlmError } from "./llm/types";
import { LiveText } from "./liveText";
import { assemblePrompt, dedupeSources, finishReport, revisionPrompt } from "./prompts";

// The assembler (tech spec §7.6). It merges the task outputs into report
// version 1. In revision mode it applies the user instruction to the latest
// version and writes the next one (FR-25).

export const run = internalAction({
  args: { missionId: v.id("missions"), revisionNodeId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const { missionId } = args;
    const context = await ctx.runQuery(internal.engine.state.assembleContext, args);
    if (!context || context.stopped) return { ok: false };

    const isRevision = args.revisionNodeId !== undefined;
    const nodeId = args.revisionNodeId ?? ASSEMBLER_ID;
    let client;
    try {
      client = await loadLlmClient(ctx, context.mode, context.modelProfile);
    } catch (error) {
      await emit(ctx, missionId, [
        { type: "node_failed", nodeId, payload: { error: errorMessage(error), retryable: false, attempt: 1 } },
      ]);
      if (!isRevision) await ctx.runMutation(internal.engine.state.failMission, { missionId, error: errorMessage(error) });
      return { ok: false };
    }
    const model = client.modelFor("assembler");
    const title = context.title ?? "Report";

    if (!isRevision && context.inputs.length === 0) {
      await ctx.runMutation(internal.engine.state.failMission, {
        missionId,
        error: "No task finished, so there is no report to write.",
      });
      return { ok: false };
    }
    if (isRevision && (!context.previousReport || !context.instruction)) {
      await emit(ctx, missionId, [
        { type: "node_failed", nodeId, payload: { error: "There is no report to change.", retryable: false, attempt: 1 } },
      ]);
      return { ok: false };
    }

    await emit(ctx, missionId, [
      ...(isRevision ? [] : [{ type: "mission_status" as const, payload: { status: "assembling" as const } }]),
      { type: "node_started", nodeId, payload: { attempt: 1, model } },
    ]);

    const live = new LiveText(ctx, missionId, nodeId);
    try {
      const prompt = isRevision
        ? revisionPrompt({ goal: context.goal, report: context.previousReport ?? "", instruction: context.instruction ?? "" })
        : assemblePrompt({ goal: context.goal, title: context.title, inputs: context.inputs, failed: context.failed });
      const result = await client.step({
          role: "assembler",
          // Revisions do not use the budget (tech spec §7.1).
          acquire: callGate(ctx, { missionId, nodeId, attempt: 1, model, ignoreBudget: isRevision }),
          system: isRevision ? REVISION_PROMPT : ASSEMBLER_PROMPT,
          messages: [{ role: "user", content: prompt }],
          tools: [],
          onDelta: live.push,
          sim: {
            seed: `${missionId}:${nodeId}:1`,
            goal: context.goal,
            planTitle: title,
            inputs: context.inputs,
            failed: context.failed,
            ...(isRevision ? { instruction: context.instruction ?? "", previousReport: context.previousReport ?? "" } : {}),
          },
        });
      await live.clear();
      if (result.text.trim().length < 20) throw new Error("The model returned an empty report.");

      const sources = dedupeSources(
        isRevision ? context.previousSources : context.inputs.flatMap((input) => input.sources),
      );
      const markdown = finishReport({ body: result.text, title, failed: isRevision ? [] : context.failed, sources });
      const outputArtifactId = await saveArtifact(ctx, { missionId, nodeId, kind: "node_output", text: markdown });
      const { version, words } = await ctx.runMutation(internal.engine.state.saveDeliverable, {
        missionId,
        markdown,
        sources,
        ...(isRevision && context.instruction ? { instruction: context.instruction } : {}),
      });

      await emit(ctx, missionId, [
        {
          type: "thought",
          nodeId,
          payload: {
            step: 1,
            text: isRevision
              ? `Applied the change and wrote version ${version} of the report.`
              : `Merged ${context.inputs.length} ${context.inputs.length === 1 ? "section" : "sections"} into the report.`,
          },
        },
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
        { type: "node_done", nodeId, payload: { summary: `Report v${version}`, outputArtifactId, sources } },
        { type: "deliverable_ready", payload: { version, words, sourceCount: sources.length } },
      ]);
      return { ok: true };
    } catch (error) {
      await live.clear();
      if (error instanceof StopSignal) return { ok: false };
      const message = errorMessage(error);
      await emit(ctx, missionId, [
        {
          type: "node_failed",
          nodeId,
          payload: { error: message, retryable: error instanceof LlmError && error.retryable, attempt: 1 },
        },
      ]);
      // A failed revision keeps the mission and its old versions (the workflow finishes it).
      if (!isRevision) {
        await ctx.runMutation(internal.engine.state.failMission, { missionId, error: `The report was not written: ${message}` });
      }
      return { ok: false };
    }
  },
});
