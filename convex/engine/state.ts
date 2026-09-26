import { cancel, type WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { appendEventsTx } from "../events";
import { limits } from "../limits";
import {
  DEPENDENCY_INPUT_MAX_CHARS,
  RATE_LIMIT_MAX_WAIT_MS,
  REPORT_INPUT_MAX_CHARS,
  SECTION_INPUT_MAX_CHARS,
  STUCK_MISSION_MS,
} from "../../src/shared/constants";
import { ACTIVE_MISSION_STATUSES, isMissionActive, source, type Source } from "../../src/shared/events";
import { isTerminalNodeStatus, readyNodeIds } from "../../src/shared/plan";
import { stripSources } from "../../src/shared/report";

// Queries and mutations for the engine actions and workflows. Only the engine
// calls them. The UI reads events, never these.

const MAX_NODES = 100;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n\n[Cut: the text continues.]`;
}

async function nodesOf(ctx: QueryCtx, missionId: Id<"missions">): Promise<Doc<"nodes">[]> {
  return await ctx.db
    .query("nodes")
    .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", missionId))
    .take(MAX_NODES);
}

async function artifactText(ctx: QueryCtx, artifactId: Id<"artifacts"> | undefined): Promise<string> {
  if (!artifactId) return "";
  const artifact = await ctx.db.get("artifacts", artifactId);
  return artifact?.text ?? "";
}

function base(mission: Doc<"missions">) {
  return {
    goal: mission.goal,
    title: mission.title ?? null,
    mode: mission.mode,
    modelProfile: mission.modelProfile,
    stopped: mission.stopRequested || !isMissionActive(mission.status),
  };
}

export const planContext = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    return mission ? base(mission) : null;
  },
});

export const workerContext = internalQuery({
  args: { missionId: v.id("missions"), nodeId: v.string() },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (!mission) return null;
    const nodes = await nodesOf(ctx, args.missionId);
    const node = nodes.find((row) => row.nodeId === args.nodeId);
    if (!node) return null;
    const dependencies = [];
    for (const depId of node.dependsOn) {
      const dep = nodes.find((row) => row.nodeId === depId);
      if (!dep) continue;
      dependencies.push({
        nodeId: dep.nodeId,
        title: dep.title,
        status: dep.status,
        markdown: dep.status === "done" ? clip(await artifactText(ctx, dep.outputArtifactId), DEPENDENCY_INPUT_MAX_CHARS) : "",
        sources: dep.sources ?? [],
        error: dep.error ?? null,
      });
    }
    return {
      ...base(mission),
      node: {
        nodeId: node.nodeId,
        role: node.role,
        title: node.title,
        instructions: node.instructions,
        status: node.status,
        attempt: node.attempt,
      },
      dependencies,
    };
  },
});

export const assembleContext = internalQuery({
  args: { missionId: v.id("missions"), revisionNodeId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (!mission) return null;
    const nodes = await nodesOf(ctx, args.missionId);
    const workers = nodes.filter((row) => row.role !== "revision").sort((a, b) => a._creationTime - b._creationTime);
    const inputs: { title: string; markdown: string; sources: Source[] }[] = [];
    const failed: string[] = [];
    for (const worker of workers) {
      if (worker.status === "done") {
        inputs.push({
          title: worker.title,
          markdown: clip(await artifactText(ctx, worker.outputArtifactId), SECTION_INPUT_MAX_CHARS),
          sources: worker.sources ?? [],
        });
      } else {
        failed.push(worker.title);
      }
    }
    const latest = await ctx.db
      .query("deliverables")
      .withIndex("by_missionId_and_version", (q) => q.eq("missionId", args.missionId))
      .order("desc")
      .first();
    const revision = args.revisionNodeId ? nodes.find((row) => row.nodeId === args.revisionNodeId) : undefined;
    return {
      ...base(mission),
      inputs,
      failed,
      nextVersion: (latest?.version ?? 0) + 1,
      previousReport: latest ? clip(stripSources(latest.markdown), REPORT_INPUT_MAX_CHARS) : null,
      previousSources: latest?.sources ?? [],
      instruction: revision?.instructions ?? null,
    };
  },
});

/** The ready nodes of the next wave, or stop (tech spec §7.1 step 2). */
export const nextWave = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args): Promise<{ stop: boolean; ready: string[] }> => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (!mission || mission.stopRequested || !isMissionActive(mission.status)) return { stop: true, ready: [] };
    const nodes = await nodesOf(ctx, args.missionId);
    const tasks = nodes
      .filter((row) => row.role !== "revision")
      .map((row) => ({ id: row.nodeId, status: row.status, dependsOn: row.dependsOn }));
    return { stop: false, ready: readyNodeIds(tasks) };
  },
});

export type CallGate =
  | { ok: true; waitMs: number }
  | { ok: false; reason: "stopped" | "budget" | "capacity" | "busy" };

/**
 * Run before each model call (tech spec §7.4 step 1 and 2, FR-16). In one
 * transaction: check the stop flag, reserve one call of the budget, and in
 * live mode take one call of the daily cap and a slot of the minute limit.
 */
export const beginCall = internalMutation({
  args: {
    missionId: v.id("missions"),
    /** Revisions do not use the budget (tech spec §7.1). */
    ignoreBudget: v.optional(v.boolean()),
    /** Calls to keep free for later steps. Workers keep 1 for the assembler. */
    keep: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CallGate> => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (!mission || mission.stopRequested || !isMissionActive(mission.status)) return { ok: false, reason: "stopped" };
    if (!args.ignoreBudget && mission.callsReserved >= mission.budget - (args.keep ?? 0)) {
      return { ok: false, reason: "budget" };
    }

    let waitMs = 0;
    if (mission.mode === "live") {
      const day = await limits.limit(ctx, "openrouterDay");
      if (!day.ok) return { ok: false, reason: "capacity" };
      const minute = await limits.limit(ctx, "openrouterMinute", { reserve: true });
      waitMs = Math.ceil(minute.retryAfter ?? 0);
      if (waitMs > RATE_LIMIT_MAX_WAIT_MS) return { ok: false, reason: "busy" };
    }
    if (!args.ignoreBudget) await ctx.db.patch("missions", mission._id, { callsReserved: mission.callsReserved + 1 });
    return { ok: true, waitMs };
  },
});

/** Take one web search from the daily Tavily cap (tech spec §8). */
export const takeSearch = internalMutation({
  args: {},
  handler: async (ctx): Promise<boolean> => (await limits.limit(ctx, "tavilyDay")).ok,
});

/** A worker step threw (timeout or crash). Fail the node, so the mission goes on. */
export async function failNodeTx(ctx: MutationCtx, args: { missionId: Id<"missions">; nodeId: string; error: string }) {
  const node = await ctx.db
    .query("nodes")
    .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", args.missionId).eq("nodeId", args.nodeId))
    .unique();
  if (!node || isTerminalNodeStatus(node.status)) return;
  await appendEventsTx(ctx, args.missionId, [
    {
      type: "node_failed",
      nodeId: args.nodeId,
      payload: { error: args.error, retryable: false, attempt: Math.max(1, node.attempt) },
    },
  ]);
}

export const failNode = internalMutation({
  args: { missionId: v.id("missions"), nodeId: v.string(), error: v.string() },
  handler: (ctx, args) => failNodeTx(ctx, args),
});

export const saveDeliverable = internalMutation({
  args: {
    missionId: v.id("missions"),
    markdown: v.string(),
    sources: v.array(source),
    instruction: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ version: number; words: number }> => {
    const latest = await ctx.db
      .query("deliverables")
      .withIndex("by_missionId_and_version", (q) => q.eq("missionId", args.missionId))
      .order("desc")
      .first();
    const version = (latest?.version ?? 0) + 1;
    const words = args.markdown.split(/\s+/).filter(Boolean).length;
    await ctx.db.insert("deliverables", {
      missionId: args.missionId,
      version,
      markdown: args.markdown,
      sources: args.sources,
      words,
      ...(args.instruction ? { instruction: args.instruction } : {}),
    });
    return { version, words };
  },
});

async function addInboxItem(ctx: MutationCtx, mission: Doc<"missions">, kind: "mission_completed" | "mission_failed") {
  await ctx.db.insert("inboxItems", { userId: mission.userId, kind, missionId: mission._id });
}

/** The last step of a run: mission_completed and an Inbox item (tech spec §7.1). */
export async function finishTx(ctx: MutationCtx, args: { missionId: Id<"missions">; notify: boolean }) {
  const mission = await ctx.db.get("missions", args.missionId);
  if (!mission || !isMissionActive(mission.status)) return;
  const nodes = await nodesOf(ctx, args.missionId);
  const partial = nodes.some((row) => row.role !== "revision" && row.status !== "done");
  const durationMs = mission.durationMs ?? Math.max(0, Math.round(Date.now() - mission._creationTime));
  await appendEventsTx(ctx, args.missionId, [
    { type: "mission_completed", payload: { partial, stats: mission.stats, durationMs } },
  ]);
  await ctx.db.patch("missions", mission._id, { durationMs, stopRequested: false });
  if (args.notify) await addInboxItem(ctx, mission, "mission_completed");
}

export const finish = internalMutation({
  args: { missionId: v.id("missions"), notify: v.boolean() },
  handler: (ctx, args) => finishTx(ctx, args),
});

export async function failMissionTx(ctx: MutationCtx, mission: Doc<"missions">, error: string, cancelWorkflow: boolean) {
  if (!isMissionActive(mission.status)) return;
  await appendEventsTx(ctx, mission._id, [{ type: "mission_failed", payload: { error } }]);
  await addInboxItem(ctx, mission, "mission_failed");
  if (cancelWorkflow && mission.workflowId) {
    try {
      await cancel(ctx, components.workflow, mission.workflowId as WorkflowId);
    } catch {
      // The workflow may already be finished.
    }
  }
}

export const failMission = internalMutation({
  args: { missionId: v.id("missions"), error: v.string(), cancelWorkflow: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get("missions", args.missionId);
    if (mission) await failMissionTx(ctx, mission, args.error, args.cancelWorkflow ?? false);
  },
});

/** Cron (tech spec §11): fail each active mission with no activity for 10 minutes. */
export const sweepStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_MISSION_MS;
    for (const status of ACTIVE_MISSION_STATUSES) {
      const stuck = await ctx.db
        .query("missions")
        .withIndex("by_status_and_lastActivityAt", (q) => q.eq("status", status).lt("lastActivityAt", cutoff))
        .take(25);
      for (const mission of stuck) {
        await failMissionTx(ctx, mission, "The mission stopped responding, so Mission Control ended it.", true);
      }
    }
  },
});
