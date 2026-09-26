import { v } from "convex/values";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { EVENTS_PAGE_SIZE, EVENTS_TAIL_LIMIT } from "../src/shared/constants";
import { appError } from "../src/shared/errors";
import {
  eventInput,
  isMissionActive,
  missionStatusForEvent,
  type EventInput,
  type TaskNode,
} from "../src/shared/events";
import { isTerminalNodeStatus, nodeStatusForEvent, validatePlan } from "../src/shared/plan";
import { getOwnedMission, requireUser } from "./lib/auth";
import { addUserStats } from "./lib/stats";

// Events that may arrive after the mission ended: they start a revision.
// Other events from a finished mission (for example, a slow tool call that
// returns after a stop) are dropped, so a stopped task never flips to done.
const EVENTS_AFTER_END = new Set<EventInput["type"]>(["mission_status", "nodes_added", "revision_requested"]);

const MAX_NODES_PER_MISSION = 100;

/**
 * Append events in one transaction (tech spec §5.3). Seq numbers start at
 * mission.lastSeq + 1 and have no gaps, because Convex mutations are
 * serializable. The nodes and missions tables change in the same transaction.
 * Returns the last seq of the mission.
 */
export async function appendEventsTx(
  ctx: MutationCtx,
  missionId: Id<"missions">,
  events: readonly EventInput[],
): Promise<number> {
  const mission = await ctx.db.get("missions", missionId);
  if (!mission) throw appError("NOT_FOUND");

  const now = Date.now();
  let seq = mission.lastSeq;
  let status = mission.status;
  const stats = { ...mission.stats };
  const patch: Partial<Doc<"missions">> = {};
  const nodes = new Map<string, Doc<"nodes"> | null>();

  const loadNode = async (nodeId: string) => {
    if (!nodes.has(nodeId)) {
      const row = await ctx.db
        .query("nodes")
        .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", missionId).eq("nodeId", nodeId))
        .unique();
      nodes.set(nodeId, row);
    }
    return nodes.get(nodeId) ?? null;
  };

  const patchNode = async (row: Doc<"nodes">, update: Partial<Doc<"nodes">>) => {
    await ctx.db.patch("nodes", row._id, update);
    nodes.set(row.nodeId, { ...row, ...update });
  };

  const insertNode = async (node: TaskNode) => {
    if (await loadNode(node.id)) return;
    const row = {
      missionId,
      nodeId: node.id,
      role: node.role,
      title: node.title,
      instructions: node.instructions,
      dependsOn: node.dependsOn,
      status: "pending" as const,
      attempt: 0,
    };
    const id = await ctx.db.insert("nodes", row);
    nodes.set(node.id, { _id: id, _creationTime: now, ...row });
  };

  for (const event of events) {
    if (!isMissionActive(status) && !EVENTS_AFTER_END.has(event.type)) continue;

    seq += 1;
    await ctx.db.insert("events", { ...event, missionId, seq, at: now });

    switch (event.type) {
      case "plan_created": {
        const errors = validatePlan(event.payload.nodes);
        if (errors.length > 0) throw new Error(`plan_created has a plan that is not valid: ${errors.join(" ")}`);
        patch.title = event.payload.title;
        for (const node of event.payload.nodes) await insertNode(node);
        break;
      }
      case "nodes_added": {
        for (const node of event.payload.nodes) await insertNode(node);
        break;
      }
      case "llm_usage": {
        stats.calls += 1;
        stats.tokens += event.payload.inputTokens + event.payload.outputTokens;
        break;
      }
      case "mission_status": {
        if (isMissionActive(event.payload.status)) patch.endedAt = undefined;
        break;
      }
      case "mission_completed": {
        patch.partial = event.payload.partial;
        patch.endedAt = now;
        break;
      }
      case "mission_failed":
      case "mission_stopped": {
        patch.endedAt = now;
        const rows = await ctx.db
          .query("nodes")
          .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", missionId))
          .take(MAX_NODES_PER_MISSION);
        for (const row of rows) {
          const current = nodes.get(row.nodeId) ?? row;
          if (!isTerminalNodeStatus(current.status)) await patchNode(current, { status: "killed" });
        }
        break;
      }
      default:
        break;
    }

    const nodeStatus = nodeStatusForEvent(event);
    if (nodeStatus && event.nodeId !== undefined) {
      const row = await loadNode(event.nodeId);
      if (row) {
        const update: Partial<Doc<"nodes">> = { status: nodeStatus };
        if (event.type === "node_started") update.attempt = event.payload.attempt;
        if (event.type === "node_done") {
          update.summary = event.payload.summary;
          update.sources = event.payload.sources;
          update.error = undefined;
          if (event.payload.outputArtifactId) update.outputArtifactId = event.payload.outputArtifactId;
        }
        if (event.type === "node_failed") update.error = event.payload.error;
        await patchNode(row, update);
      }
    }

    const nextStatus = missionStatusForEvent(event);
    if (nextStatus) status = nextStatus;
  }

  if (seq === mission.lastSeq) return seq;
  await ctx.db.patch("missions", missionId, { ...patch, lastSeq: seq, lastActivityAt: now, status, stats });
  await addUserStats(ctx, mission.userId, { tokens: stats.tokens - mission.stats.tokens });
  return seq;
}

export const appendEvents = internalMutation({
  args: { missionId: v.id("missions"), events: v.array(eventInput) },
  handler: (ctx, args) => appendEventsTx(ctx, args.missionId, args.events),
});

async function listEvents(ctx: QueryCtx, missionId: Id<"missions">, afterSeq: number, limit: number) {
  const user = await requireUser(ctx);
  await getOwnedMission(ctx, missionId, user.userId);
  return await ctx.db
    .query("events")
    .withIndex("by_missionId_and_seq", (q) => q.eq("missionId", missionId).gt("seq", afterSeq))
    .take(limit);
}

const listArgs = { missionId: v.id("missions"), afterSeq: v.number() };

/** History load: up to 500 events after afterSeq (tech spec §9.1). Call it once per page, not as a subscription. */
export const page = query({
  args: listArgs,
  handler: (ctx, args) => listEvents(ctx, args.missionId, args.afterSeq, EVENTS_PAGE_SIZE),
});

/** Live tail: up to 200 events after afterSeq. The client moves afterSeq forward at 150. */
export const tail = query({
  args: listArgs,
  handler: (ctx, args) => listEvents(ctx, args.missionId, args.afterSeq, EVENTS_TAIL_LIMIT),
});
