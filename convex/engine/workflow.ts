import { WorkflowManager, vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { SAVE_ID } from "../../src/shared/plan";
import { failMissionTx, failNodeTx, finishTx } from "./state";

// The mission workflow (tech spec §7.1). Workflow code is deterministic: it
// does no IO, and steps pass only IDs. Actions write all events.

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { maxParallelism: 10 },
});

const MAX_WAVES = 12;

/** A worker step that times out runs 1 more time (tech spec §11). */
const WORKER_RETRY = { maxAttempts: 2, initialBackoffMs: 2_000, base: 2 };

export const missionWorkflow = workflow
  .define({ args: { missionId: v.id("missions") } })
  .handler(async (step, { missionId }): Promise<void> => {
    const planned = await step.runAction(internal.engine.plan.run, { missionId }, { name: "plan" });
    if (!planned.ok) return;

    // Waves: all ready tasks run in parallel. The global limits set their speed.
    for (let wave = 1; wave <= MAX_WAVES; wave += 1) {
      const next = await step.runQuery(internal.engine.state.nextWave, { missionId }, { name: `wave-${wave}` });
      if (next.stop) return;
      if (next.ready.length === 0) break;
      await Promise.all(
        next.ready.map((nodeId) =>
          step
            .runAction(internal.engine.worker.run, { missionId, nodeId }, { name: `task-${nodeId}`, retry: WORKER_RETRY })
            .catch(() =>
              step.runMutation(
                internal.engine.state.failNode,
                { missionId, nodeId, error: "The task stopped responding." },
                { name: `task-${nodeId}-failed` },
              ),
            ),
        ),
      );
    }

    const assembled = await step.runAction(internal.engine.assemble.run, { missionId }, { name: "assemble" });
    if (!assembled.ok) return;
    // The plan can ask to save the finished report to an app. A failed save
    // keeps the report and marks the mission partial.
    const saved = await step.runAction(internal.engine.save.run, { missionId }, { name: "save" }).catch(async () => {
      await step.runMutation(
        internal.events.appendEvents,
        {
          missionId,
          events: [{ type: "node_failed", nodeId: SAVE_ID, payload: { error: "The save stopped responding.", retryable: false, attempt: 1 } }],
        },
        { name: "save-failed" },
      );
      return { ok: false };
    });
    await step.runMutation(internal.engine.state.finish, { missionId, notify: true, partial: !saved.ok }, { name: "finish" });
  });

/** A revision (FR-25): the assembler writes the next version, then the mission completes again. */
export const revisionWorkflow = workflow
  .define({ args: { missionId: v.id("missions"), nodeId: v.string() } })
  .handler(async (step, { missionId, nodeId }): Promise<void> => {
    const result = await step.runAction(
      internal.engine.assemble.run,
      { missionId, revisionNodeId: nodeId },
      { name: "revise" },
    );
    await step.runMutation(internal.engine.state.finish, { missionId, notify: result.ok }, { name: "finish" });
  });

export const workflowContext = v.object({
  missionId: v.id("missions"),
  kind: v.union(v.literal("mission"), v.literal("revision")),
  nodeId: v.optional(v.string()),
});

/**
 * Runs once when a workflow ends. An error that no step caught must not leave
 * the mission active forever (tech spec §9 reliability).
 */
export const onComplete = internalMutation({
  args: { workflowId: vWorkflowId, result: vResultValidator, context: workflowContext },
  handler: async (ctx, { workflowId, result, context }) => {
    if (result.kind === "failed") {
      if (context.kind === "revision" && context.nodeId) {
        await failNodeTx(ctx, { missionId: context.missionId, nodeId: context.nodeId, error: "The revision stopped because of an error." });
        await finishTx(ctx, { missionId: context.missionId, notify: false });
      } else {
        const mission = await ctx.db.get("missions", context.missionId);
        if (mission) await failMissionTx(ctx, mission, "The mission stopped because of an internal error.", false);
      }
    }
    await workflow.cleanup(ctx, workflowId);
  },
});
