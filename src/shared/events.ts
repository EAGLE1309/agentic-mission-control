import { v, type Infer, type PropertyValidators } from "convex/values";
import { PREVIEW_MAX_CHARS } from "./constants";

// Event contract (tech spec §6). One definition gives the table schema,
// the appendEvents arguments, and the TypeScript types.

export const missionStatus = v.union(
  v.literal("queued"),
  v.literal("planning"),
  v.literal("running"),
  v.literal("assembling"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("stopped"),
);

export const nodeStatus = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("killed"),
);

export const modelProfile = v.union(v.literal("balanced"), v.literal("fast"));
export const missionMode = v.union(v.literal("live"), v.literal("simulated"));
export const workerRole = v.union(v.literal("researcher"), v.literal("writer"));
export const taskRole = v.union(v.literal("researcher"), v.literal("writer"), v.literal("revision"));
export const toolName = v.union(
  v.literal("web_search"),
  v.literal("fetch_url"),
  v.literal("write_section"),
);

export const source = v.object({ url: v.string(), title: v.string() });
export const missionStats = v.object({ calls: v.number(), tokens: v.number() });

export const planNode = v.object({
  id: v.string(),
  role: workerRole,
  title: v.string(),
  instructions: v.string(),
  dependsOn: v.array(v.string()),
});

export const taskNode = v.object({
  id: v.string(),
  role: taskRole,
  title: v.string(),
  instructions: v.string(),
  dependsOn: v.array(v.string()),
});

export type MissionStatus = Infer<typeof missionStatus>;
export type NodeStatus = Infer<typeof nodeStatus>;
export type ModelProfile = Infer<typeof modelProfile>;
export type MissionMode = Infer<typeof missionMode>;
export type WorkerRole = Infer<typeof workerRole>;
export type TaskRole = Infer<typeof taskRole>;
export type ToolName = Infer<typeof toolName>;
export type Source = Infer<typeof source>;
export type MissionStats = Infer<typeof missionStats>;
export type PlanNode = Infer<typeof planNode>;
export type TaskNode = Infer<typeof taskNode>;

const envelope = {
  missionId: v.id("missions"),
  seq: v.number(),
  at: v.number(),
};

function defineEvent<T extends string, P extends PropertyValidators>(type: T, payload: P) {
  const body = {
    type: v.literal(type),
    nodeId: v.optional(v.string()),
    payload: v.object(payload),
  };
  return { input: v.object(body), row: v.object({ ...envelope, ...body }) };
}

const missionCreated = defineEvent("mission_created", {
  goal: v.string(),
  modelProfile,
  mode: missionMode,
});
const missionStatusChanged = defineEvent("mission_status", { status: missionStatus });
const planCreated = defineEvent("plan_created", {
  title: v.string(),
  rationale: v.string(),
  nodes: v.array(planNode),
});
const nodesAdded = defineEvent("nodes_added", {
  nodes: v.array(taskNode),
  reason: v.union(v.literal("revision"), v.literal("replan"), v.literal("user_branch")),
});
const nodeQueued = defineEvent("node_queued", {
  reason: v.string(),
  retryAfterMs: v.optional(v.number()),
});
const nodeStarted = defineEvent("node_started", { attempt: v.number(), model: v.string() });
const thought = defineEvent("thought", { step: v.number(), text: v.string() });
const toolCall = defineEvent("tool_call", {
  callId: v.string(),
  tool: toolName,
  inputPreview: v.string(),
  inputArtifactId: v.optional(v.id("artifacts")),
});
const toolResult = defineEvent("tool_result", {
  callId: v.string(),
  ok: v.boolean(),
  outputPreview: v.string(),
  outputArtifactId: v.optional(v.id("artifacts")),
  durationMs: v.number(),
  error: v.optional(v.string()),
  /** The pages that the tool found or read, for favicons. Older events have none. */
  urls: v.optional(v.array(v.string())),
});
const llmUsage = defineEvent("llm_usage", {
  model: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  latencyMs: v.number(),
});
const nodeDone = defineEvent("node_done", {
  summary: v.string(),
  outputArtifactId: v.optional(v.id("artifacts")),
  sources: v.array(source),
});
const nodeFailed = defineEvent("node_failed", {
  error: v.string(),
  retryable: v.boolean(),
  attempt: v.number(),
});
const deliverableReady = defineEvent("deliverable_ready", {
  version: v.number(),
  words: v.number(),
  sourceCount: v.number(),
});
const revisionRequested = defineEvent("revision_requested", {
  instruction: v.string(),
  nodeId: v.string(),
});
const missionCompleted = defineEvent("mission_completed", {
  partial: v.boolean(),
  stats: missionStats,
  durationMs: v.number(),
});
const missionFailed = defineEvent("mission_failed", { error: v.string() });
const missionStopped = defineEvent("mission_stopped", {
  by: v.union(v.literal("user"), v.literal("system")),
});

/** An event as the engine sends it. appendEventsTx adds missionId, seq, and at. */
export const eventInput = v.union(
  missionCreated.input,
  missionStatusChanged.input,
  planCreated.input,
  nodesAdded.input,
  nodeQueued.input,
  nodeStarted.input,
  thought.input,
  toolCall.input,
  toolResult.input,
  llmUsage.input,
  nodeDone.input,
  nodeFailed.input,
  deliverableReady.input,
  revisionRequested.input,
  missionCompleted.input,
  missionFailed.input,
  missionStopped.input,
);

/** An event as the events table stores it. */
export const eventRow = v.union(
  missionCreated.row,
  missionStatusChanged.row,
  planCreated.row,
  nodesAdded.row,
  nodeQueued.row,
  nodeStarted.row,
  thought.row,
  toolCall.row,
  toolResult.row,
  llmUsage.row,
  nodeDone.row,
  nodeFailed.row,
  deliverableReady.row,
  revisionRequested.row,
  missionCompleted.row,
  missionFailed.row,
  missionStopped.row,
);

export type EventInput = Infer<typeof eventInput>;
export type MissionEvent = Infer<typeof eventRow>;
export type EventType = MissionEvent["type"];
export type EventOf<T extends EventType> = Extract<MissionEvent, { type: T }>;
export type EventInputOf<T extends EventType> = Extract<EventInput, { type: T }>;

export const ACTIVE_MISSION_STATUSES: readonly MissionStatus[] = [
  "queued",
  "planning",
  "running",
  "assembling",
];

export function isMissionActive(status: MissionStatus): boolean {
  return ACTIVE_MISSION_STATUSES.includes(status);
}

/** The mission status after an event, or null when the event does not change it. */
export function missionStatusForEvent(event: EventInput): MissionStatus | null {
  switch (event.type) {
    case "mission_status":
      return event.payload.status;
    case "mission_completed":
      return "completed";
    case "mission_failed":
      return "failed";
    case "mission_stopped":
      return "stopped";
    default:
      return null;
  }
}

/** Cut a preview to PREVIEW_MAX_CHARS with an ellipsis. */
export function preview(text: string, max = PREVIEW_MAX_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
