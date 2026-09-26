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
// version 1. A follow-up (FR-25) writes the next version: "rewrite" merges
// the task outputs again, "revise" applies the instruction to the latest
// version. A failed follow-up keeps the mission and its old versions.

const followUp = v.object({ mode: v.union(v.literal("rewrite"), v.literal("revise")), instruction: v.string() });

export const run = internalAction({
  args: { missionId: v.id("missions"), followUp: v.optional(followUp) },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const { missionId } = args;
    const context = await ctx.runQuery(internal.engine.state.assembleContext, { missionId });
    if (!context || context.stopped) return { ok: false };

    const nodeId = ASSEMBLER_ID;
    const revise = args.followUp?.mode === "revise";
    const instruction = args.followUp?.instruction.trim() ?? "";
    // Each version is one attempt, so the trace keeps the versions apart.
    const attempt = context.nextVersion;
    const fail = async (error: string, retryable = false) => {
      await emit(ctx, missionId, [{ type: "node_failed", nodeId, payload: { error, retryable, attempt } }]);
      if (!args.followUp) await ctx.runMutation(internal.engine.state.failMission, { missionId, error: `The report was not written: ${error}` });
      return { ok: false };
    };

    let client;
    try {
      client = await loadLlmClient(ctx, context.mode, context.modelProfile);
    } catch (error) {
      return await fail(errorMessage(error));
    }
    const model = client.modelFor("assembler");
    const title = context.title ?? "Report";

    if (!revise && context.inputs.length === 0) return await fail("No task finished, so there is no report to write.");
    if (revise && (!context.previousReport || !instruction)) return await fail("There is no report to change.");

    await emit(ctx, missionId, [
      { type: "mission_status", payload: { status: "assembling" } },
      { type: "node_started", nodeId, payload: { attempt, model } },
    ]);

    const live = new LiveText(ctx, missionId, nodeId);
    try {
      const prompt = revise
        ? revisionPrompt({ goal: context.goal, report: context.previousReport ?? "", instruction })
        : assemblePrompt({ goal: context.goal, title: context.title, inputs: context.inputs, failed: context.failed, instruction });
      const result = await client.step({
        role: "assembler",
        // An edit of the text does not use the budget (tech spec §7.1).
        acquire: callGate(ctx, { missionId, nodeId, attempt, model, ignoreBudget: revise }),
        system: revise ? REVISION_PROMPT : ASSEMBLER_PROMPT,
        messages: [{ role: "user", content: prompt }],
        tools: [],
        onDelta: live.push,
        sim: {
          seed: `${missionId}:${nodeId}:${attempt}`,
          goal: context.goal,
          planTitle: title,
          inputs: context.inputs,
          failed: context.failed,
          ...(revise ? { instruction, previousReport: context.previousReport ?? "" } : {}),
        },
      });
      await live.clear();
      if (result.text.trim().length < 20) throw new Error("The model returned an empty report.");

      const sources = dedupeSources(revise ? context.previousSources : context.inputs.flatMap((input) => input.sources));
      const markdown = finishReport({ body: result.text, title, failed: revise ? [] : context.failed, sources });
      const outputArtifactId = await saveArtifact(ctx, { missionId, nodeId, kind: "node_output", text: markdown });
      const { version, words } = await ctx.runMutation(internal.engine.state.saveDeliverable, {
        missionId,
        markdown,
        sources,
        ...(instruction ? { instruction } : {}),
      });

      const sections = `${context.inputs.length} ${context.inputs.length === 1 ? "section" : "sections"}`;
      await emit(ctx, missionId, [
        {
          type: "thought",
          nodeId,
          payload: {
            step: 1,
            text: revise
              ? `Applied the change and wrote version ${version} of the report.`
              : args.followUp
                ? `Merged ${sections} again into version ${version} of the report.`
                : `Merged ${sections} into the report.`,
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
      return await fail(errorMessage(error), error instanceof LlmError && error.retryable);
    }
  },
});
