import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { DIRECTOR_PROMPT } from "../../src/shared/agents";
import { appSpec, isAppSlug } from "../../src/shared/apps";
import { MAX_TASKS_TOTAL, PLAN_REPAIR_ATTEMPTS } from "../../src/shared/constants";
import type { EventInput } from "../../src/shared/events";
import { rerunClosure, validateAddedTasks } from "../../src/shared/plan";
import { emit, errorMessage } from "./emit";
import { StopSignal, callGate } from "./gate";
import { loadLlmClient } from "./llm/client";
import { LlmError } from "./llm/types";
import { saveToErrors, saveToSchema, taskSchema } from "./plan";
import { directPrompt, type DirectState } from "./prompts";

// The director of a follow-up turn (FR-25). The orchestrator reads the whole
// mission and the message of the user, and returns a turn: a reply, tasks to
// run again, new tasks, what happens to the report, and an app to save it to.
// A Rerun button sends task IDs instead, and no model runs.

export const turnSchema = z.object({
  reply: z.string().trim().min(1).max(1_500),
  rerun: z
    .array(z.object({ id: z.string().trim(), instructions: z.string().trim().max(4_000).nullish() }))
    .max(12)
    .default([]),
  add: z.array(taskSchema).max(6).default([]),
  report: z.enum(["keep", "rewrite", "revise"]).default("keep"),
  reportInstruction: z.string().trim().max(2_000).nullish(),
  saveTo: saveToSchema,
});

export type Turn = z.infer<typeof turnSchema>;

/** The errors of a turn, in plain words for the model. An empty list means it can run. */
export function validateTurn(turn: Turn, state: Pick<DirectState, "tasks" | "apps">): string[] {
  const errors: string[] = [];
  const ids = state.tasks.map((task) => task.id);
  for (const item of turn.rerun) {
    if (!ids.includes(item.id)) errors.push(`rerun: "${item.id}" is not a task. The tasks are: ${ids.join(", ") || "none"}.`);
  }
  errors.push(...validateAddedTasks(state.tasks, turn.add, MAX_TASKS_TOTAL));
  if (state.apps.length === 0 && turn.add.some((task) => task.role === "librarian")) {
    errors.push('The user has no connected apps, so do not add "librarian" tasks.');
  }
  errors.push(...saveToErrors(turn.saveTo, state.apps));
  const runs = turn.rerun.length + turn.add.length > 0;
  if (turn.report === "rewrite" && !runs && !state.tasks.some((task) => task.status === "done")) {
    errors.push('No task finished, so "rewrite" has nothing to write from. Rerun or add tasks, or keep the report.');
  }
  return errors;
}

export type TurnPlan = {
  ok: boolean;
  /** The tasks that this turn runs: the ones reset and the ones added. */
  taskIds: string[];
  report: "keep" | "rewrite" | "revise";
  instruction: string;
  save: boolean;
  saveApp?: string;
};

const NOTHING: TurnPlan = { ok: false, taskIds: [], report: "keep", instruction: "", save: false };

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function titleList(titles: string[]): string {
  const quoted = titles.map((title) => `“${title}”`);
  return quoted.length <= 1 ? (quoted[0] ?? "") : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

export const run = internalAction({
  args: { missionId: v.id("missions"), nodeId: v.string(), rerunIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { missionId, nodeId, rerunIds }): Promise<TurnPlan> => {
    const state = await ctx.runQuery(internal.engine.state.directContext, { missionId, nodeId });
    if (!state || state.stopped) return NOTHING;
    const fail = async (error: string, retryable = false) => {
      await emit(ctx, missionId, [{ type: "node_failed", nodeId, payload: { error, retryable, attempt: 1 } }]);
      return NOTHING;
    };

    let turn: Turn;
    const usage: EventInput[] = [];
    if (rerunIds) {
      const tasks = state.tasks.filter((task) => rerunIds.includes(task.id));
      if (tasks.length === 0) return await fail("Those tasks are not in this mission.");
      await emit(ctx, missionId, [{ type: "node_started", nodeId, payload: { attempt: 1, model: "" } }]);
      turn = {
        reply: `Running ${titleList(tasks.map((task) => task.title))} again. Then the assembler writes a new version of the report.`,
        rerun: tasks.map((task) => ({ id: task.id })),
        add: [],
        report: "rewrite",
        saveTo: null,
      };
    } else {
      let client;
      try {
        client = await loadLlmClient(ctx, state.mode, state.modelProfile);
      } catch (error) {
        return await fail(errorMessage(error));
      }
      const model = client.modelFor("orchestrator");
      await emit(ctx, missionId, [{ type: "node_started", nodeId, payload: { attempt: 1, model } }]);
      const feedback: string[] = [];
      let found: Turn | null = null;
      try {
        for (let attempt = 1; attempt <= PLAN_REPAIR_ATTEMPTS + 1 && !found; attempt += 1) {
          const result = await client.object({
            role: "orchestrator",
            // A turn always gets its answer: the director does not use the budget.
            acquire: callGate(ctx, { missionId, nodeId, attempt: 1, model, ignoreBudget: true }),
            system: DIRECTOR_PROMPT,
            prompt: directPrompt(state, feedback),
            schema: turnSchema,
            sim: {
              seed: `${missionId}:${nodeId}:${attempt}`,
              goal: state.goal,
              apps: state.apps,
              turn: {
                message: state.message,
                tasks: state.tasks.map((task) => ({ id: task.id, role: task.role, title: task.title, status: task.status })),
                hasReport: state.report !== null,
                saves: state.saves.map((copy) => ({ app: copy.app, url: copy.url })),
              },
            },
          });
          usage.push({
            type: "llm_usage",
            nodeId,
            payload: {
              model: result.model,
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
              latencyMs: result.latencyMs,
            },
          });
          const errors = validateTurn(result.object, state);
          if (errors.length === 0) found = result.object;
          else feedback.splice(0, feedback.length, ...errors);
        }
      } catch (error) {
        if (error instanceof StopSignal) return NOTHING;
        if (usage.length > 0) await emit(ctx, missionId, usage);
        return await fail(errorMessage(error), error instanceof LlmError && error.retryable);
      }
      if (!found) {
        await emit(ctx, missionId, usage);
        return await fail("The orchestrator could not turn the message into a valid step. Try other words.");
      }
      turn = found;
    }

    // Tasks that run change the task outputs, so the report is written again.
    const resetIds = rerunClosure(state.tasks, turn.rerun.map((item) => item.id));
    const newInstructions = new Map(turn.rerun.flatMap((item) => (item.instructions ? [[item.id, item.instructions] as const] : [])));
    const added = turn.add.map((task) => ({
      id: task.id,
      role: task.role,
      title: shorten(task.title || task.id, 80),
      instructions: task.instructions || task.title,
      dependsOn: task.dependsOn,
    }));
    const runs = resetIds.length + added.length > 0;
    let report = turn.report;
    if (runs || (report === "revise" && !state.report)) report = "rewrite";
    const instruction = report === "keep" ? "" : turn.reportInstruction?.trim() || state.message;
    const saveTo = turn.saveTo ? { app: turn.saveTo.app, ...(turn.saveTo.target ? { target: turn.saveTo.target } : {}) } : null;

    const events: EventInput[] = [{ type: "thought", nodeId, payload: { step: 1, text: turn.reply } }, ...usage];
    if (resetIds.length > 0) {
      events.push({
        type: "nodes_reset",
        payload: { nodes: resetIds.map((id) => ({ id, ...(newInstructions.has(id) ? { instructions: newInstructions.get(id) } : {}) })) },
      });
    }
    if (added.length > 0) events.push({ type: "nodes_added", payload: { reason: "user_branch", nodes: added } });
    if (saveTo) events.push({ type: "save_requested", payload: saveTo });
    if (runs) events.push({ type: "mission_status", payload: { status: "running" } });
    await emit(ctx, missionId, events);

    return {
      ok: true,
      taskIds: [...resetIds, ...added.map((task) => task.id)],
      report,
      instruction,
      save: saveTo !== null,
      ...(saveTo ? { saveApp: isAppSlug(saveTo.app) ? appSpec(saveTo.app).name : saveTo.app } : {}),
    };
  },
});
