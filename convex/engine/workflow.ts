import { WorkflowManager, vResultValidator, vWorkflowId, type WorkflowCtx } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
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

/**
 * Waves: all ready tasks run in parallel, until no task is ready. The global
 * limits set their speed. `prefix` keeps step names unique in one workflow.
 * Returns false when the mission stopped.
 */
async function runWaves(step: WorkflowCtx, missionId: Id<"missions">, prefix = ""): Promise<boolean> {
  for (let wave = 1; wave <= MAX_WAVES; wave += 1) {
    const next = await step.runQuery(internal.engine.state.nextWave, { missionId }, { name: `${prefix}wave-${wave}` });
    if (next.stop) return false;
    if (next.ready.length === 0) break;
    await Promise.all(
      next.ready.map((nodeId) =>
        step
          .runAction(internal.engine.worker.run, { missionId, nodeId }, { name: `${prefix}task-${nodeId}`, retry: WORKER_RETRY })
          .catch(() =>
            step.runMutation(
              internal.engine.state.failNode,
              { missionId, nodeId, error: "The task stopped responding." },
              { name: `${prefix}task-${nodeId}-failed` },
            ),
          ),
      ),
    );
  }
  return true;
}

/** The save step after the report (plan saveTo, or a follow-up). A crash fails only the save. */
async function runSave(step: WorkflowCtx, missionId: Id<"missions">): Promise<boolean> {
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
  return saved.ok;
}

export const missionWorkflow = workflow
  .define({ args: { missionId: v.id("missions") } })
  .handler(async (step, { missionId }): Promise<void> => {
    const planned = await step.runAction(internal.engine.plan.run, { missionId }, { name: "plan" });
    if (!planned.ok) return;
    if (!(await runWaves(step, missionId))) return;

    const assembled = await step.runAction(internal.engine.assemble.run, { missionId }, { name: "assemble" });
    if (!assembled.ok) return;
    // The plan can ask to save the finished report to an app. A failed save
    // keeps the report and marks the mission partial.
    const saved = await runSave(step, missionId);
    await step.runMutation(internal.engine.state.finish, { missionId, notify: true, partial: !saved }, { name: "finish" });
  });

/**
 * A follow-up turn in the chat (FR-25). The director reads the mission and the
 * message, and picks the work: tasks run again or new tasks run in waves, the
 * assembler writes the next version or edits the text, and the save step puts
 * the report in an app. Then the turn closes and the mission completes again.
 */
export const followUpWorkflow = workflow
  .define({ args: { missionId: v.id("missions"), nodeId: v.string(), rerunIds: v.optional(v.array(v.string())) } })
  .handler(async (step, { missionId, nodeId, rerunIds }): Promise<void> => {
    const turn = await step.runAction(internal.engine.direct.run, { missionId, nodeId, ...(rerunIds ? { rerunIds } : {}) }, { name: "direct" });
    const close = (report: "none" | "written" | "failed", save: "none" | "saved" | "failed") =>
      step.runMutation(
        internal.engine.state.closeTurn,
        { missionId, nodeId, taskIds: turn.taskIds, report, save, ...(turn.saveApp ? { saveApp: turn.saveApp } : {}) },
        { name: "close" },
      );
    if (!turn.ok) {
      await close("none", "none");
      return;
    }
    if (turn.taskIds.length > 0 && !(await runWaves(step, missionId, "follow-up-"))) return;

    let report: "none" | "written" | "failed" = "none";
    if (turn.report !== "keep") {
      const assembled = await step.runAction(
        internal.engine.assemble.run,
        { missionId, followUp: { mode: turn.report, instruction: turn.instruction } },
        { name: "assemble" },
      );
      report = assembled.ok ? "written" : "failed";
    }
    let save: "none" | "saved" | "failed" = "none";
    if (turn.save) save = (await runSave(step, missionId)) ? "saved" : "failed";
    await close(report, save);
  });

export const workflowContext = v.object({
  missionId: v.id("missions"),
  /** "revision" is a follow-up turn. */
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
        await failNodeTx(ctx, { missionId: context.missionId, nodeId: context.nodeId, error: "The follow-up stopped because of an error." });
        await finishTx(ctx, { missionId: context.missionId, notify: false });
      } else {
        const mission = await ctx.db.get("missions", context.missionId);
        if (mission) await failMissionTx(ctx, mission, "The mission stopped because of an internal error.", false);
      }
    }
    await workflow.cleanup(ctx, workflowId);
  },
});
