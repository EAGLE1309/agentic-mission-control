import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { ORCHESTRATOR_PROMPT } from "../../src/shared/agents";
import { PLAN_REPAIR_ATTEMPTS } from "../../src/shared/constants";
import { ORCHESTRATOR_ID, validatePlan } from "../../src/shared/plan";
import { emit, errorMessage } from "./emit";
import { StopSignal, callGate } from "./gate";
import { loadLlmClient } from "./llm/client";
import { LlmError } from "./llm/types";
import { planPrompt } from "./prompts";

// The orchestrator (tech spec §7.3): a plan of 2 to 6 tasks. A plan that is not
// valid goes back to the model with its errors, 2 times at most. The user
// never sees a partial plan (FR-12).

const planSchema = z.object({
  title: z.string().trim().min(1).max(200),
  rationale: z.string().trim().max(1_000).default(""),
  nodes: z
    .array(
      z.object({
        id: z.string().trim(),
        role: z.enum(["researcher", "writer"]),
        title: z.string().trim().max(200),
        instructions: z.string().trim().max(4_000),
        dependsOn: z.array(z.string().trim()).default([]),
      }),
    )
    .min(1)
    .max(12),
});

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export const run = internalAction({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }): Promise<{ ok: boolean }> => {
    const context = await ctx.runQuery(internal.engine.state.planContext, { missionId });
    if (!context || context.stopped) return { ok: false };

    let client;
    try {
      client = await loadLlmClient(ctx, context.mode, context.modelProfile);
    } catch (error) {
      // For example, live mode with no OpenRouter key.
      await ctx.runMutation(internal.engine.state.failMission, { missionId, error: errorMessage(error) });
      return { ok: false };
    }
    const model = client.modelFor("orchestrator");
    await emit(ctx, missionId, [
      { type: "mission_status", payload: { status: "planning" } },
      { type: "node_started", nodeId: ORCHESTRATOR_ID, payload: { attempt: 1, model } },
      { type: "thought", nodeId: ORCHESTRATOR_ID, payload: { step: 1, text: "Reading the goal and splitting it into tasks." } },
    ]);

    const feedback: string[] = [];
    let failure = "The orchestrator did not make a valid plan.";
    let step = 1;

    try {
      for (let attempt = 1; attempt <= PLAN_REPAIR_ATTEMPTS + 1; attempt += 1) {
        const result = await client.object({
          role: "orchestrator",
          // The plan keeps one call of the budget free for the assembler.
          acquire: callGate(ctx, { missionId, nodeId: ORCHESTRATOR_ID, attempt: 1, model, keep: 1 }),
          system: ORCHESTRATOR_PROMPT,
          prompt: planPrompt(context.goal, feedback),
          schema: planSchema,
          sim: { seed: `${missionId}:orchestrator:${attempt}`, goal: context.goal },
        });
        step += 1;
        const usage = {
          type: "llm_usage" as const,
          nodeId: ORCHESTRATOR_ID,
          payload: {
            model: result.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: result.latencyMs,
          },
        };
        const plan = result.object;
        const errors = validatePlan(plan.nodes);

        if (errors.length === 0) {
          const rationale = shorten(plan.rationale || `Split the goal into ${plan.nodes.length} tasks.`, 500);
          await emit(ctx, missionId, [
            { type: "thought", nodeId: ORCHESTRATOR_ID, payload: { step, text: rationale } },
            usage,
            {
              type: "plan_created",
              nodeId: ORCHESTRATOR_ID,
              payload: {
                title: shorten(plan.title, 80),
                rationale,
                nodes: plan.nodes.map((node) => ({
                  id: node.id,
                  role: node.role,
                  title: shorten(node.title || node.id, 80),
                  instructions: node.instructions || node.title,
                  dependsOn: node.dependsOn,
                })),
              },
            },
            {
              type: "node_done",
              nodeId: ORCHESTRATOR_ID,
              payload: { summary: rationale, sources: [] },
            },
            { type: "mission_status", payload: { status: "running" } },
          ]);
          return { ok: true };
        }

        feedback.splice(0, feedback.length, ...errors);
        await emit(ctx, missionId, [
          {
            type: "thought",
            nodeId: ORCHESTRATOR_ID,
            payload: { step, text: shorten(`The plan has problems, so I will fix it: ${errors.join(" ")}`, 500) },
          },
          usage,
        ]);
      }
    } catch (error) {
      if (error instanceof StopSignal) return { ok: false };
      failure = errorMessage(error);
      await emit(ctx, missionId, [
        {
          type: "node_failed",
          nodeId: ORCHESTRATOR_ID,
          payload: { error: failure, retryable: error instanceof LlmError && error.retryable, attempt: 1 },
        },
      ]);
      await ctx.runMutation(internal.engine.state.failMission, {
        missionId,
        error: `The plan was not made: ${failure}`,
      });
      return { ok: false };
    }

    await emit(ctx, missionId, [
      { type: "node_failed", nodeId: ORCHESTRATOR_ID, payload: { error: failure, retryable: false, attempt: 1 } },
    ]);
    await ctx.runMutation(internal.engine.state.failMission, {
      missionId,
      error: "The orchestrator did not make a valid plan. Try again, or write the goal in a different way.",
    });
    return { ok: false };
  },
});
