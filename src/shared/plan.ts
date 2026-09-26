import { PLAN_MAX_TASKS, PLAN_MIN_TASKS } from "./constants";
import type { EventInput, NodeStatus, PlanNode } from "./events";

// Graph rules (tech spec §6.3). The reducer and appendEventsTx both use them,
// so the UI and the nodes table always agree.

export type NodeRole = "orchestrator" | "researcher" | "writer" | "librarian" | "assembler" | "report" | "revision";

export const ORCHESTRATOR_ID = "orchestrator";
export const ASSEMBLER_ID = "assembler";
export const REPORT_ID = "report";
export const CRITIC_ID = "critic";
/** The step after the report that saves it to an app (plan saveTo). It is a librarian with no model. */
export const SAVE_ID = "save";

export const RESERVED_NODE_IDS: readonly string[] = [ORCHESTRATOR_ID, ASSEMBLER_ID, CRITIC_ID, REPORT_ID, SAVE_ID];
export const PLAN_NODE_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const REVISION_ID_PATTERN = /^revision-\d+$/;

export const TERMINAL_NODE_STATUSES: readonly NodeStatus[] = ["done", "failed", "killed"];

export function isTerminalNodeStatus(status: NodeStatus): boolean {
  return TERMINAL_NODE_STATUSES.includes(status);
}

export function isReservedNodeId(id: string): boolean {
  return RESERVED_NODE_IDS.includes(id) || REVISION_ID_PATTERN.test(id);
}

export function revisionNodeId(n: number): string {
  return `revision-${n}`;
}

export function isWorkerRole(role: NodeRole): boolean {
  return role === "researcher" || role === "writer" || role === "librarian";
}

/**
 * Check a plan from the orchestrator. Returns errors in plain words, so the
 * engine can send them back to the model. An empty list means the plan is valid.
 */
export function validatePlan(nodes: readonly PlanNode[]): string[] {
  const errors: string[] = [];

  if (nodes.length < PLAN_MIN_TASKS || nodes.length > PLAN_MAX_TASKS) {
    errors.push(`The plan has ${nodes.length} tasks. Make ${PLAN_MIN_TASKS} to ${PLAN_MAX_TASKS} tasks.`);
  }

  const ids = new Set<string>();
  for (const node of nodes) {
    if (!PLAN_NODE_ID_PATTERN.test(node.id)) {
      errors.push(`Task ID "${node.id}" is not valid. Use 1 to 32 characters: a-z, 0-9, and "-".`);
    } else if (isReservedNodeId(node.id)) {
      errors.push(`Task ID "${node.id}" is reserved. Use a different ID.`);
    }
    if (ids.has(node.id)) errors.push(`Task ID "${node.id}" is used more than one time. Each ID must be unique.`);
    ids.add(node.id);
    if (!node.title.trim()) errors.push(`Task "${node.id}" has no title.`);
    if (!node.instructions.trim()) errors.push(`Task "${node.id}" has no instructions.`);
  }

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (dep === node.id) errors.push(`Task "${node.id}" depends on itself.`);
      else if (!ids.has(dep)) errors.push(`Task "${node.id}" depends on "${dep}", which is not in the plan.`);
    }
    if (new Set(node.dependsOn).size !== node.dependsOn.length) {
      errors.push(`Task "${node.id}" lists the same dependency more than one time.`);
    }
  }

  if (nodes.length > 0 && !nodes.some((node) => node.dependsOn.length === 0)) {
    errors.push("No task can start first. At least one task must have no dependencies.");
  }

  const cycle = findCycle(nodes);
  if (cycle) errors.push(`The dependencies make a cycle: ${cycle.join(" -> ")}.`);

  return errors;
}

/** Returns one cycle as a list of IDs, or null. Ignores unknown dependencies. */
function findCycle(nodes: readonly { id: string; dependsOn: readonly string[] }[]): string[] | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    const mark = state.get(id);
    if (mark === "done") return null;
    if (mark === "visiting") return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, "visiting");
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (dep === id || !byId.has(dep)) continue;
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  }

  for (const node of nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }
  return null;
}

export type GraphNodeRef = { id: string; role: NodeRole; dependsOn: readonly string[] };
export type FlowEdge = { id: string; source: string; target: string };

export function edgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

/** The flow edges of the graph, in node order. */
export function flowEdges(nodes: readonly GraphNodeRef[]): FlowEdge[] {
  const ids = new Set(nodes.map((node) => node.id));
  const workers = nodes.filter((node) => isWorkerRole(node.role) && node.id !== SAVE_ID);
  const needed = new Set(workers.flatMap((node) => node.dependsOn));
  const edges: FlowEdge[] = [];
  const add = (source: string, target: string) => {
    if (ids.has(source) && ids.has(target)) edges.push({ id: edgeId(source, target), source, target });
  };

  for (const worker of workers) {
    if (worker.dependsOn.length === 0) add(ORCHESTRATOR_ID, worker.id);
    for (const dep of worker.dependsOn) add(dep, worker.id);
  }
  for (const worker of workers) {
    if (!needed.has(worker.id)) add(worker.id, ASSEMBLER_ID);
  }
  add(ASSEMBLER_ID, REPORT_ID);
  add(REPORT_ID, SAVE_ID);
  for (const node of nodes) {
    if (node.role === "revision") add(REPORT_ID, node.id);
  }
  return edges;
}

/**
 * Pending nodes whose dependencies are all terminal. A dependency that is not
 * in the list counts as terminal, so a bad reference cannot block the mission.
 */
export function readyNodeIds(
  nodes: readonly { id: string; status: NodeStatus; dependsOn: readonly string[] }[],
): string[] {
  const statusById = new Map(nodes.map((node) => [node.id, node.status]));
  return nodes
    .filter((node) => node.status === "pending")
    .filter((node) =>
      node.dependsOn.every((dep) => {
        const status = statusById.get(dep);
        return status === undefined || isTerminalNodeStatus(status);
      }),
    )
    .map((node) => node.id);
}

/** The status of the event's node after a node event, or null for other events. */
export function nodeStatusForEvent(event: EventInput): NodeStatus | null {
  switch (event.type) {
    case "node_queued":
      return "queued";
    case "node_started":
      return "running";
    case "node_done":
      return "done";
    case "node_failed":
      return "failed";
    default:
      return null;
  }
}

/** True when the event ends the mission, so each non-terminal node becomes killed. */
export function endsOpenNodes(event: EventInput): boolean {
  return event.type === "mission_stopped" || event.type === "mission_failed";
}
