import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  eventRow,
  missionMode,
  missionStats,
  missionStatus,
  modelProfile,
  nodeStatus,
  source,
  taskRole,
} from "../src/shared/events";

// Data model (tech spec §5.1). Later milestones add their own tables.

export const artifactKind = v.union(
  v.literal("prompt"),
  v.literal("tool_input"),
  v.literal("tool_output"),
  v.literal("node_output"),
);

export default defineSchema({
  missions: defineTable({
    /** identity.tokenIdentifier of the owner. */
    userId: v.string(),
    goal: v.string(),
    title: v.optional(v.string()),
    status: missionStatus,
    partial: v.boolean(),
    modelProfile,
    mode: missionMode,
    workflowId: v.optional(v.string()),
    lastSeq: v.number(),
    stopRequested: v.boolean(),
    stats: missionStats,
    /** Maximum model calls for the mission (FR-16). */
    budget: v.number(),
    /** Model calls reserved by beginCall. It never goes above budget. */
    callsReserved: v.number(),
    revisionCount: v.number(),
    endedAt: v.optional(v.number()),
    /** Duration of the first run, kept for revisions. */
    durationMs: v.optional(v.number()),
    lastActivityAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status_and_lastActivityAt", ["status", "lastActivityAt"])
    .searchIndex("search_goal", { searchField: "goal", filterFields: ["userId", "status"] }),

  /** The event log. Rows are only added, never changed or deleted. */
  events: defineTable(eventRow).index("by_missionId_and_seq", ["missionId", "seq"]),

  /** The engine copy of the task state. Only the engine reads it. */
  nodes: defineTable({
    missionId: v.id("missions"),
    nodeId: v.string(),
    role: taskRole,
    title: v.string(),
    instructions: v.string(),
    dependsOn: v.array(v.string()),
    status: nodeStatus,
    attempt: v.number(),
    outputArtifactId: v.optional(v.id("artifacts")),
    summary: v.optional(v.string()),
    sources: v.optional(v.array(source)),
    error: v.optional(v.string()),
  }).index("by_missionId_and_nodeId", ["missionId", "nodeId"]),

  artifacts: defineTable({
    missionId: v.id("missions"),
    nodeId: v.optional(v.string()),
    kind: artifactKind,
    text: v.string(),
    truncated: v.boolean(),
  }).index("by_missionId", ["missionId"]),

  /** Report versions (FR-15, FR-25). */
  deliverables: defineTable({
    missionId: v.id("missions"),
    version: v.number(),
    markdown: v.string(),
    sources: v.array(source),
    words: v.number(),
    instruction: v.optional(v.string()),
  }).index("by_missionId_and_version", ["missionId", "version"]),

  /** Notifications (FR-27). readAt is missing while unread. */
  inboxItems: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("mission_completed"), v.literal("mission_failed")),
    missionId: v.id("missions"),
    readAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_readAt", ["userId", "readAt"]),

  /** All-time totals for the Usage page (FR-28). Counters change in the same transactions as missions. */
  userStats: defineTable({
    userId: v.string(),
    missions: v.number(),
    tokens: v.number(),
  }).index("by_userId", ["userId"]),

  /** Free OpenRouter models (tech spec §7.2). A cron job updates it each day. */
  modelCatalog: defineTable({
    modelId: v.string(),
    name: v.string(),
    contextLength: v.number(),
    supportsTools: v.boolean(),
    supportsStructured: v.boolean(),
    lastSeenAt: v.number(),
  }).index("by_modelId", ["modelId"]),

  /**
   * Third-party apps that a user connected through Composio (design §6.8).
   * Composio holds the tokens and is the source of truth; composio.sync copies
   * the active connections here, so the page is reactive.
   */
  appConnections: defineTable({
    userId: v.string(),
    toolkit: v.string(),
    connectedAccountId: v.string(),
    connectedAt: v.number(),
  }).index("by_userId_and_toolkit", ["userId", "toolkit"]),

  /** Live thought text of each task. Not in the event log, so replay does not show it. */
  nodeLive: defineTable({
    missionId: v.id("missions"),
    nodeId: v.string(),
    text: v.string(),
    updatedAt: v.number(),
  }).index("by_missionId_and_nodeId", ["missionId", "nodeId"]),
});
