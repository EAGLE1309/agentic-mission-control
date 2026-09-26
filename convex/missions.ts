import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator, type FilterBuilder, type NamedTableInfo } from "convex/server";
import { mutation, query } from "./_generated/server";
import { resolveMode } from "./engine/llm/client";
import { workflow } from "./engine/workflow";
import { appendEventsTx } from "./events";
import { getOwnedMission, requireUser } from "./lib/auth";
import { addUserStats } from "./lib/stats";
import { MISSION_QUOTA_OFF, limits, nextUtcDay } from "./limits";
import {
  ADMISSION_MIN_DAILY_CALLS,
  GOAL_MAX_CHARS,
  MAX_REVISIONS,
  MISSION_CALL_BUDGET,
  REVISION_MAX_CHARS,
} from "../src/shared/constants";
import { appError } from "../src/shared/errors";
import { isMissionActive, modelProfile } from "../src/shared/events";
import { revisionNodeId } from "../src/shared/plan";

function shorten(text: string, max: number): string {
  const line = text.split("\n").find((part) => part.trim())?.trim() ?? text.trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Start a mission (tech spec §7.1). One transaction: check the input, the
 * shared capacity, and the daily quota, then add the mission and start the
 * workflow. If a step fails, all steps roll back.
 */
export const create = mutation({
  args: { goal: v.string(), modelProfile },
  handler: async (ctx, args): Promise<Id<"missions">> => {
    const user = await requireUser(ctx);
    const goal = args.goal.trim();
    if (!goal) throw appError("INVALID_INPUT", { message: "Enter a goal." });
    if (goal.length > GOAL_MAX_CHARS) {
      throw appError("INVALID_INPUT", { message: `Shorten the goal to ${GOAL_MAX_CHARS} characters or less.` });
    }

    const mode = resolveMode();
    if (mode === "live") {
      const capacity = await limits.check(ctx, "openrouterDay", { count: ADMISSION_MIN_DAILY_CALLS });
      if (!capacity.ok) throw appError("CAPACITY_EXHAUSTED", { resetAt: nextUtcDay(Date.now()) });
    }
    if (!MISSION_QUOTA_OFF) {
      const quota = await limits.limit(ctx, "missionsPerUser", { key: user.userId });
      if (!quota.ok) throw appError("QUOTA_EXCEEDED", { resetAt: Date.now() + (quota.retryAfter ?? 0) });
    }

    const now = Date.now();
    const missionId = await ctx.db.insert("missions", {
      userId: user.userId,
      goal,
      title: shorten(goal, 80),
      status: "queued",
      partial: false,
      modelProfile: args.modelProfile,
      mode,
      lastSeq: 0,
      stopRequested: false,
      stats: { calls: 0, tokens: 0 },
      budget: MISSION_CALL_BUDGET,
      callsReserved: 0,
      revisionCount: 0,
      lastActivityAt: now,
    });
    await appendEventsTx(ctx, missionId, [
      { type: "mission_created", payload: { goal, modelProfile: args.modelProfile, mode } },
    ]);
    const workflowId = await workflow.start(
      ctx,
      internal.engine.workflow.missionWorkflow,
      { missionId },
      { onComplete: internal.engine.workflow.onComplete, context: { missionId, kind: "mission" } },
    );
    await ctx.db.patch("missions", missionId, { workflowId });
    await addUserStats(ctx, user.userId, { missions: 1 });
    return missionId;
  },
});

/** Stop a running mission (FR-18). Finished tasks and their output stay. */
export const stop = mutation({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const mission = await getOwnedMission(ctx, args.missionId, user.userId);
    if (!isMissionActive(mission.status)) throw appError("MISSION_NOT_ACTIVE");
    await ctx.db.patch("missions", mission._id, { stopRequested: true });
    await appendEventsTx(ctx, mission._id, [{ type: "mission_stopped", payload: { by: "user" } }]);
    if (mission.workflowId) {
      try {
        await workflow.cancel(ctx, mission.workflowId as WorkflowId);
      } catch {
        // The workflow may already be finished. The stop flag still stops the actions.
      }
    }
  },
});

/** Ask for changes to the report (FR-25). 3 revisions for each mission at most. */
export const revise = mutation({
  args: { missionId: v.id("missions"), instruction: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const mission = await getOwnedMission(ctx, args.missionId, user.userId);
    if (mission.status !== "completed") {
      throw appError("INVALID_INPUT", { message: "You can ask for changes when the report is ready." });
    }
    const latest = await ctx.db
      .query("deliverables")
      .withIndex("by_missionId_and_version", (q) => q.eq("missionId", mission._id))
      .order("desc")
      .first();
    if (!latest) throw appError("INVALID_INPUT", { message: "This mission has no report to change." });
    if (mission.revisionCount >= MAX_REVISIONS) {
      throw appError("INVALID_INPUT", {
        message: `This mission has ${MAX_REVISIONS} revisions. Start a new mission for more changes.`,
      });
    }
    const instruction = args.instruction.trim();
    if (!instruction) throw appError("INVALID_INPUT", { message: "Enter the change you want." });
    if (instruction.length > REVISION_MAX_CHARS) {
      throw appError("INVALID_INPUT", { message: `Shorten the change to ${REVISION_MAX_CHARS} characters or less.` });
    }

    const count = mission.revisionCount + 1;
    const nodeId = revisionNodeId(count);
    await appendEventsTx(ctx, mission._id, [
      { type: "revision_requested", payload: { instruction, nodeId } },
      {
        type: "nodes_added",
        payload: {
          reason: "revision",
          nodes: [{ id: nodeId, role: "revision", title: shorten(instruction, 80), instructions: instruction, dependsOn: [] }],
        },
      },
      { type: "mission_status", payload: { status: "assembling" } },
    ]);
    await ctx.db.patch("missions", mission._id, { revisionCount: count, stopRequested: false });
    const workflowId = await workflow.start(
      ctx,
      internal.engine.workflow.revisionWorkflow,
      { missionId: mission._id, nodeId },
      { onComplete: internal.engine.workflow.onComplete, context: { missionId: mission._id, kind: "revision", nodeId } },
    );
    await ctx.db.patch("missions", mission._id, { workflowId });
  },
});

/**
 * The mission header for the run view. The ID comes from the URL, so a
 * malformed ID gives NOT_FOUND, like a mission of a different user.
 */
export const get = query({
  args: { missionId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const missionId = ctx.db.normalizeId("missions", args.missionId);
    if (!missionId) throw appError("NOT_FOUND");
    const mission = await getOwnedMission(ctx, missionId, user.userId);
    return {
      _id: mission._id,
      title: mission.title ?? mission.goal,
      goal: mission.goal,
      status: mission.status,
      partial: mission.partial,
      mode: mission.mode,
      modelProfile: mission.modelProfile,
      revisionCount: mission.revisionCount,
      maxRevisions: MAX_REVISIONS,
      createdAt: mission._creationTime,
      endedAt: mission.endedAt ?? null,
      durationMs: mission.durationMs ?? null,
      lastSeq: mission.lastSeq,
      stats: mission.stats,
    };
  },
});

export const statusFilter = v.union(
  v.literal("all"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("stopped"),
);

function missionRow(mission: Doc<"missions">) {
  return {
    _id: mission._id,
    title: mission.title ?? mission.goal,
    status: mission.status,
    partial: mission.partial,
    createdAt: mission._creationTime,
    endedAt: mission.endedAt ?? null,
    durationMs: mission.durationMs ?? null,
    tokens: mission.stats.tokens,
  };
}

/**
 * The missions list (FR-26): newest first, or by relevance with a search.
 * "Running" covers each active status, and "Partial" is completed with missing parts.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator, status: statusFilter, search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const term = (args.search ?? "").trim().slice(0, 200);
    const status = args.status;

    const matches = (q: FilterBuilder<NamedTableInfo<DataModel, "missions">>) => {
      switch (status) {
        case "running":
          return q.or(
            q.eq(q.field("status"), "queued"),
            q.eq(q.field("status"), "planning"),
            q.eq(q.field("status"), "running"),
            q.eq(q.field("status"), "assembling"),
          );
        case "completed":
          return q.and(q.eq(q.field("status"), "completed"), q.eq(q.field("partial"), false));
        case "partial":
          return q.and(q.eq(q.field("status"), "completed"), q.eq(q.field("partial"), true));
        case "failed":
        case "stopped":
          return q.eq(q.field("status"), status);
        default:
          return true;
      }
    };

    const result = term
      ? await ctx.db
          .query("missions")
          .withSearchIndex("search_goal", (q) => q.search("goal", term).eq("userId", user.userId))
          .filter(matches)
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("missions")
          .withIndex("by_userId", (q) => q.eq("userId", user.userId))
          .order("desc")
          .filter(matches)
          .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(missionRow) };
  },
});

/** Missions whose goal matches the palette search (FR-6). */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const term = args.query.trim().slice(0, 200);
    if (term.length < 2) return [];
    const rows = await ctx.db
      .query("missions")
      .withSearchIndex("search_goal", (q) => q.search("goal", term).eq("userId", user.userId))
      .take(5);
    return rows.map((mission) => ({ id: mission._id, title: mission.title ?? mission.goal, goal: mission.goal }));
  },
});
