import { ROLE_LABEL } from "@/components/agent-icons";
import { nodeStatusKind, statusSpec } from "@/components/status";
import { ASSEMBLER_ID, ORCHESTRATOR_ID, REPORT_ID, isWorkerRole } from "@/shared/plan";
import type { MissionNode, MissionView, Satellite } from "@/shared/reducer";

// Pure helpers that turn reducer state into graph state (design §6.4).

export type EdgeState = "waiting" | "active" | "delivered" | "failed";

export function flowEdgeState(source: MissionNode | undefined): EdgeState {
  switch (source?.status) {
    case "running":
      return "active";
    case "done":
      return "delivered";
    case "failed":
      return "failed";
    default:
      return "waiting";
  }
}

export function toolEdgeState(satellite: Satellite | undefined): EdgeState {
  if (!satellite) return "waiting";
  return satellite.running > 0 ? "active" : "delivered";
}

/** Where a new node starts its entry: the position of its parent (design §6.4). */
export function spawnParent(view: Pick<MissionView, "nodes" | "satellites">, id: string): string | undefined {
  const satellite = view.satellites[id];
  if (satellite) return satellite.nodeId;
  const node = view.nodes[id];
  if (!node) return undefined;
  if (isWorkerRole(node.role)) return node.dependsOn[0] ?? ORCHESTRATOR_ID;
  if (node.role === "assembler") return undefined;
  if (node.role === "report") return ASSEMBLER_ID;
  if (node.role === "revision") return REPORT_ID;
  return undefined;
}

export function nodeAriaLabel(node: MissionNode): string {
  const status = statusSpec(nodeStatusKind(node.status)).label;
  if (node.role === "report") return `Report, ${status}`;
  return `${ROLE_LABEL[node.role]} task: ${node.title}, ${status}`;
}

/** A key that changes when any node label changes (title or status). */
export function labelsKey(view: Pick<MissionView, "nodes" | "nodeOrder">): string {
  return view.nodeOrder.map((id) => `${id}:${view.nodes[id]?.status}:${view.nodes[id]?.title}`).join("|");
}

/** The IDs of the running tasks, for follow mode. */
export function runningKey(view: Pick<MissionView, "nodes" | "nodeOrder">): string {
  return view.nodeOrder.filter((id) => view.nodes[id]?.status === "running" || view.nodes[id]?.status === "queued").join(",");
}
