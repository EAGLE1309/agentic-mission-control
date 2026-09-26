import { produce, type Draft } from "immer";
import type { GenericId } from "convex/values";
import { PACKET_BUFFER } from "./constants";
import type {
  MissionEvent,
  MissionMode,
  MissionStatus,
  ModelProfile,
  NodeStatus,
  PlanNode,
  Source,
  TaskNode,
  ToolName,
} from "./events";
import {
  ASSEMBLER_ID,
  ORCHESTRATOR_ID,
  REPORT_ID,
  edgeId,
  flowEdges,
  isTerminalNodeStatus,
  nodeStatusForEvent,
  type NodeRole,
} from "./plan";

// The reducer (tech spec §9.2). It turns events into all mission UI state.
// The live view, replay, share page, and landing demo all use it.

export type ArtifactId = GenericId<"artifacts">;

export type TraceStep = {
  attempt: number;
  step: number;
  at: number;
  text: string;
  model: string | null;
  tokens: number;
  latencyMs: number;
  callIds: string[];
};

export type NodeFailure = { attempt: number; at: number; error: string; retryable: boolean };

export type MissionNode = {
  id: string;
  role: NodeRole;
  title: string;
  instructions: string;
  dependsOn: string[];
  status: NodeStatus;
  attempt: number;
  model: string | null;
  /** Added after the first plan (revision, replan, branch). Cleared when the node starts. */
  isNew: boolean;
  queuedReason: string | null;
  /** Text of the latest finished step. The live thought comes from nodeLive. */
  lastThought: string | null;
  currentTool: ToolName | null;
  summary: string | null;
  error: string | null;
  sources: Source[];
  outputArtifactId: ArtifactId | null;
  startedAt: number | null;
  endedAt: number | null;
  tokens: number;
  toolCallCount: number;
  steps: TraceStep[];
  failures: NodeFailure[];
};

export type ToolCallStatus = "running" | "ok" | "error" | "cancelled";

export type ToolCall = {
  callId: string;
  nodeId: string;
  tool: ToolName;
  seq: number;
  at: number;
  status: ToolCallStatus;
  inputPreview: string;
  inputArtifactId: ArtifactId | null;
  outputPreview: string | null;
  outputArtifactId: ArtifactId | null;
  durationMs: number | null;
  error: string | null;
};

export type Satellite = { id: string; nodeId: string; tool: ToolName; calls: number; running: number };

export type GraphEdge = { id: string; source: string; target: string; kind: "flow" | "tool" };

export type Packet = {
  id: string;
  /** The seq of the event. The canvas animates only packets newer than its last render. */
  seq: number;
  edgeId: string;
  direction: "out" | "back";
  tone: "live" | "destructive";
};

export type NarrationItem = { seq: number; at: number; text: string };
export type RevisionItem = { nodeId: string; instruction: string; at: number };
export type ReportVersion = {
  version: number;
  at: number;
  words: number;
  sourceCount: number;
  instruction: string | null;
};

export type MissionView = {
  lastSeq: number;
  goal: string;
  modelProfile: ModelProfile;
  mode: MissionMode;
  title: string | null;
  rationale: string | null;
  status: MissionStatus;
  partial: boolean;
  createdAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  error: string | null;
  stoppedBy: "user" | "system" | null;
  stats: { calls: number; tokens: number; toolCalls: number };
  nodes: Record<string, MissionNode>;
  /** Node IDs in the order they were added (plan order). */
  nodeOrder: string[];
  edges: GraphEdge[];
  satellites: Record<string, Satellite>;
  toolCalls: Record<string, ToolCall>;
  /** Tool call IDs in call order (stream activity list). */
  activity: string[];
  packets: Packet[];
  narration: NarrationItem[];
  revisions: RevisionItem[];
  versions: ReportVersion[];
};

export function initialMissionView(): MissionView {
  return {
    lastSeq: 0,
    goal: "",
    modelProfile: "balanced",
    mode: "live",
    title: null,
    rationale: null,
    status: "queued",
    partial: false,
    createdAt: null,
    endedAt: null,
    durationMs: null,
    error: null,
    stoppedBy: null,
    stats: { calls: 0, tokens: 0, toolCalls: 0 },
    nodes: {},
    nodeOrder: [],
    edges: [],
    satellites: {},
    toolCalls: {},
    activity: [],
    packets: [],
    narration: [],
    revisions: [],
    versions: [],
  };
}

/**
 * Apply new events. Events with seq <= state.lastSeq are skipped, so a page
 * and a tail that overlap are safe. Returns the same object when nothing is new.
 */
export function applyEvents(state: MissionView, events: readonly MissionEvent[]): MissionView {
  if (!events.some((event) => event.seq > state.lastSeq)) return state;
  const ordered = isSortedBySeq(events) ? events : [...events].sort((a, b) => a.seq - b.seq);
  return produce(state, (draft) => {
    for (const event of ordered) {
      if (event.seq <= draft.lastSeq) continue;
      draft.lastSeq = event.seq;
      applyEvent(draft, event);
    }
  });
}

/** Build the state from the start, up to and including uptoSeq (replay). */
export function reduceEvents(events: readonly MissionEvent[], uptoSeq = Number.POSITIVE_INFINITY): MissionView {
  return applyEvents(
    initialMissionView(),
    events.filter((event) => event.seq <= uptoSeq),
  );
}

function isSortedBySeq(events: readonly MissionEvent[]): boolean {
  for (let i = 1; i < events.length; i += 1) {
    if (events[i].seq < events[i - 1].seq) return false;
  }
  return true;
}

type State = Draft<MissionView>;
type NodeDraft = Draft<MissionNode>;

function applyEvent(state: State, event: MissionEvent): void {
  switch (event.type) {
    case "mission_created": {
      state.goal = event.payload.goal;
      state.modelProfile = event.payload.modelProfile;
      state.mode = event.payload.mode;
      state.createdAt = event.at;
      state.status = "queued";
      addNode(state, {
        id: ORCHESTRATOR_ID,
        role: "orchestrator",
        title: "Plan the mission",
        instructions: event.payload.goal,
        dependsOn: [],
        isNew: false,
      });
      rebuildEdges(state);
      return;
    }

    case "mission_status": {
      state.status = event.payload.status;
      return;
    }

    case "plan_created": {
      state.title = event.payload.title;
      state.rationale = event.payload.rationale;
      if (!state.nodes[ORCHESTRATOR_ID]) {
        addNode(state, { id: ORCHESTRATOR_ID, role: "orchestrator", title: "", instructions: state.goal, dependsOn: [], isNew: false });
      }
      const orchestrator = state.nodes[ORCHESTRATOR_ID];
      orchestrator.title = event.payload.title;
      orchestrator.summary = event.payload.rationale;
      for (const node of event.payload.nodes) addTaskNode(state, node, false);
      addNode(state, { id: ASSEMBLER_ID, role: "assembler", title: "Write the report", instructions: "", dependsOn: [], isNew: false });
      addNode(state, { id: REPORT_ID, role: "report", title: "Report", instructions: "", dependsOn: [], isNew: false });
      rebuildEdges(state);
      return;
    }

    case "nodes_added": {
      for (const node of event.payload.nodes) addTaskNode(state, node, true);
      rebuildEdges(state);
      return;
    }

    case "revision_requested": {
      state.revisions.push({ nodeId: event.payload.nodeId, instruction: event.payload.instruction, at: event.at });
      return;
    }

    case "node_queued": {
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      setNodeStatus(node, event);
      node.queuedReason = event.payload.reason;
      return;
    }

    case "node_started": {
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      // The engine sends node_started with the same attempt after a wait for a
      // model slot. Only a higher attempt is a retry.
      const isRetry = event.payload.attempt > node.attempt && node.attempt > 0;
      setNodeStatus(node, event);
      node.attempt = event.payload.attempt;
      node.model = event.payload.model;
      node.isNew = false;
      node.queuedReason = null;
      node.startedAt ??= event.at;
      node.endedAt = null;
      if (isRetry) {
        node.error = null;
        node.currentTool = null;
      }
      return;
    }

    case "thought": {
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      node.steps.push({
        attempt: node.attempt,
        step: event.payload.step,
        at: event.at,
        text: event.payload.text,
        model: null,
        tokens: 0,
        latencyMs: 0,
        callIds: [],
      });
      const text = event.payload.text.trim();
      if (text) {
        node.lastThought = text;
        if (node.id === ORCHESTRATOR_ID) state.narration.push({ seq: event.seq, at: event.at, text });
      }
      return;
    }

    case "llm_usage": {
      const tokens = event.payload.inputTokens + event.payload.outputTokens;
      state.stats.calls += 1;
      state.stats.tokens += tokens;
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      node.tokens += tokens;
      node.model = event.payload.model;
      const step = lastStep(node);
      if (step && step.model === null) {
        step.model = event.payload.model;
        step.tokens = tokens;
        step.latencyMs = event.payload.latencyMs;
      }
      return;
    }

    case "tool_call": {
      const node = nodeOf(state, event.nodeId);
      const { callId, tool } = event.payload;
      if (!node || state.toolCalls[callId]) return;

      const satelliteId = `${node.id}:${tool}`;
      let satellite = state.satellites[satelliteId];
      if (!satellite) {
        satellite = { id: satelliteId, nodeId: node.id, tool, calls: 0, running: 0 };
        state.satellites[satelliteId] = satellite;
        state.edges.push({ id: edgeId(node.id, satelliteId), source: node.id, target: satelliteId, kind: "tool" });
      }
      satellite.calls += 1;
      satellite.running += 1;

      state.toolCalls[callId] = {
        callId,
        nodeId: node.id,
        tool,
        seq: event.seq,
        at: event.at,
        status: "running",
        inputPreview: event.payload.inputPreview,
        inputArtifactId: event.payload.inputArtifactId ?? null,
        outputPreview: null,
        outputArtifactId: null,
        durationMs: null,
        error: null,
      };
      state.activity.push(callId);
      state.stats.toolCalls += 1;
      node.toolCallCount += 1;
      node.currentTool = tool;

      let step = lastStep(node);
      if (!step) {
        step = { attempt: node.attempt, step: 1, at: event.at, text: "", model: null, tokens: 0, latencyMs: 0, callIds: [] };
        node.steps.push(step);
      }
      step.callIds.push(callId);

      pushPacket(state, { id: `p${event.seq}`, seq: event.seq, edgeId: edgeId(node.id, satelliteId), direction: "out", tone: "live" });
      return;
    }

    case "tool_result": {
      const call = state.toolCalls[event.payload.callId];
      if (!call || call.status !== "running") return;
      call.status = event.payload.ok ? "ok" : "error";
      call.outputPreview = event.payload.outputPreview;
      call.outputArtifactId = event.payload.outputArtifactId ?? null;
      call.durationMs = event.payload.durationMs;
      call.error = event.payload.error ?? null;

      const satelliteId = `${call.nodeId}:${call.tool}`;
      const satellite = state.satellites[satelliteId];
      if (satellite) satellite.running = Math.max(0, satellite.running - 1);
      const node = state.nodes[call.nodeId];
      if (node) node.currentTool = runningToolOf(state, node.id);

      pushPacket(state, {
        id: `p${event.seq}`,
        seq: event.seq,
        edgeId: edgeId(call.nodeId, satelliteId),
        direction: "back",
        tone: event.payload.ok ? "live" : "destructive",
      });
      return;
    }

    case "node_done": {
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      setNodeStatus(node, event);
      node.summary = event.payload.summary;
      node.sources = event.payload.sources.map((item) => ({ url: item.url, title: item.title }));
      node.outputArtifactId = event.payload.outputArtifactId ?? null;
      node.error = null;
      node.endedAt = event.at;
      node.queuedReason = null;
      cancelOpenToolCalls(state, node.id, event.at);
      return;
    }

    case "node_failed": {
      const node = nodeOf(state, event.nodeId);
      if (!node) return;
      setNodeStatus(node, event);
      node.error = event.payload.error;
      node.failures.push({
        attempt: event.payload.attempt,
        at: event.at,
        error: event.payload.error,
        retryable: event.payload.retryable,
      });
      node.endedAt = event.at;
      node.queuedReason = null;
      cancelOpenToolCalls(state, node.id, event.at);
      return;
    }

    case "deliverable_ready": {
      const { version, words, sourceCount } = event.payload;
      const instruction = version > 1 ? (state.revisions.at(-1)?.instruction ?? null) : null;
      const entry = { version, at: event.at, words, sourceCount, instruction };
      const index = state.versions.findIndex((item) => item.version === version);
      if (index >= 0) state.versions[index] = entry;
      else {
        state.versions.push(entry);
        state.versions.sort((a, b) => a.version - b.version);
      }
      const report = state.nodes[REPORT_ID];
      if (report) {
        report.status = "done";
        report.isNew = false;
        report.startedAt ??= event.at;
        report.endedAt = event.at;
        report.summary = `v${version}`;
      }
      return;
    }

    case "mission_completed": {
      state.status = "completed";
      state.partial = event.payload.partial;
      state.durationMs = event.payload.durationMs;
      state.endedAt = event.at;
      state.stats.calls = event.payload.stats.calls;
      state.stats.tokens = event.payload.stats.tokens;
      return;
    }

    case "mission_failed": {
      state.status = "failed";
      state.error = event.payload.error;
      endMission(state, event.at);
      return;
    }

    case "mission_stopped": {
      state.status = "stopped";
      state.stoppedBy = event.payload.by;
      endMission(state, event.at);
      return;
    }

    default: {
      // Unknown type from a newer backend: lastSeq already moved. Ignore it.
      return;
    }
  }
}

function nodeOf(state: State, nodeId: string | undefined): NodeDraft | undefined {
  return nodeId === undefined ? undefined : state.nodes[nodeId];
}

function lastStep(node: NodeDraft): Draft<TraceStep> | undefined {
  const step = node.steps.at(-1);
  return step && step.attempt === node.attempt ? step : undefined;
}

function setNodeStatus(node: NodeDraft, event: MissionEvent): void {
  const status = nodeStatusForEvent(event);
  if (status) node.status = status;
}

function addNode(
  state: State,
  spec: { id: string; role: NodeRole; title: string; instructions: string; dependsOn: readonly string[]; isNew: boolean },
): void {
  if (state.nodes[spec.id]) return;
  state.nodes[spec.id] = {
    id: spec.id,
    role: spec.role,
    title: spec.title,
    instructions: spec.instructions,
    dependsOn: [...spec.dependsOn],
    status: "pending",
    attempt: 0,
    model: null,
    isNew: spec.isNew,
    queuedReason: null,
    lastThought: null,
    currentTool: null,
    summary: null,
    error: null,
    sources: [],
    outputArtifactId: null,
    startedAt: null,
    endedAt: null,
    tokens: 0,
    toolCallCount: 0,
    steps: [],
    failures: [],
  };
  state.nodeOrder.push(spec.id);
}

function addTaskNode(state: State, node: PlanNode | TaskNode, isNew: boolean): void {
  addNode(state, { ...node, isNew });
}

function rebuildEdges(state: State): void {
  const refs = state.nodeOrder.map((id) => state.nodes[id]);
  const flow: GraphEdge[] = flowEdges(refs).map((edge) => ({ ...edge, kind: "flow" }));
  const tool = state.edges.filter((edge) => edge.kind === "tool");
  state.edges = [...flow, ...tool];
}

function runningToolOf(state: State, nodeId: string): ToolName | null {
  for (const satellite of Object.values(state.satellites)) {
    if (satellite.nodeId === nodeId && satellite.running > 0) return satellite.tool;
  }
  return null;
}

function cancelOpenToolCalls(state: State, nodeId: string | null, at: number): void {
  for (const call of Object.values(state.toolCalls)) {
    if (call.status !== "running" || (nodeId !== null && call.nodeId !== nodeId)) continue;
    call.status = "cancelled";
    call.durationMs = Math.max(0, Math.round(at - call.at));
    const satellite = state.satellites[`${call.nodeId}:${call.tool}`];
    if (satellite) satellite.running = Math.max(0, satellite.running - 1);
  }
  if (nodeId !== null) {
    const node = state.nodes[nodeId];
    if (node) node.currentTool = null;
  }
}

/** Stop or failure of the mission: each open node becomes killed. */
function endMission(state: State, at: number): void {
  state.endedAt = at;
  state.durationMs = state.createdAt === null ? null : Math.max(0, Math.round(at - state.createdAt));
  cancelOpenToolCalls(state, null, at);
  for (const node of Object.values(state.nodes)) {
    node.currentTool = null;
    if (isTerminalNodeStatus(node.status)) continue;
    node.status = "killed";
    node.queuedReason = null;
    node.endedAt = at;
  }
}

function pushPacket(state: State, packet: Packet): void {
  state.packets.push(packet);
  if (state.packets.length > PACKET_BUFFER) state.packets.splice(0, state.packets.length - PACKET_BUFFER);
}
