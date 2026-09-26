import { Graph, layout as dagreLayout } from "@dagrejs/dagre";
import type { ToolName } from "./events";
import type { MissionView } from "./reducer";

// Graph layout (tech spec §9.3, design §6.4): dagre, left to right, with nodes
// sorted by ID, so the layout is deterministic. Satellites stack under their
// task card, and dagre reserves their height.

export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 104;
export const RANK_GAP = 72;
export const NODE_GAP = 24;
export const SATELLITE_HEIGHT = 28;
export const SATELLITE_GAP = 6;
export const SATELLITE_TOP = 12;
export const SATELLITE_INDENT = 24;

/**
 * The size React Flow uses for a satellite, so it never has to measure one:
 * 8px padding, 14px icon, 6px gaps, the tool name in 12px mono, and the call
 * count (for example "×3"). The chip itself sizes to its content.
 */
export function satelliteWidth(tool: ToolName, calls: number, sites = 0): number {
  const favicons = sites > 0 ? 6 + sites * 16 + (sites - 1) * 4 : 0;
  return Math.ceil(8 + 14 + 6 + tool.length * 7.8 + 6 + (1 + String(calls).length) * 7 + favicons + 8);
}

const TOOL_ORDER: readonly ToolName[] = ["web_search", "fetch_url", "write_section"];

export type Position = { x: number; y: number };
export type GraphLayout = {
  /** Top-left position of each node and satellite. */
  positions: Record<string, Position>;
  width: number;
  height: number;
};

type LayoutInput = Pick<MissionView, "nodes" | "edges" | "satellites">;

function satellitesByNode(input: LayoutInput): Map<string, string[]> {
  const byNode = new Map<string, string[]>();
  const satellites = Object.values(input.satellites).sort(
    (a, b) => TOOL_ORDER.indexOf(a.tool) - TOOL_ORDER.indexOf(b.tool),
  );
  for (const satellite of satellites) {
    const list = byNode.get(satellite.nodeId) ?? [];
    list.push(satellite.id);
    byNode.set(satellite.nodeId, list);
  }
  return byNode;
}

/** A key that changes only when nodes, edges, or satellites change, not on status changes. */
export function layoutKey(input: LayoutInput): string {
  const nodes = Object.keys(input.nodes).sort().join(",");
  const edges = input.edges
    .filter((edge) => edge.kind === "flow")
    .map((edge) => edge.id)
    .sort()
    .join(",");
  const satellites = Object.keys(input.satellites).sort().join(",");
  return `${nodes}|${edges}|${satellites}`;
}

export function layoutGraph(input: LayoutInput): GraphLayout {
  const graph = new Graph();
  graph.setGraph({ rankdir: "LR", ranksep: RANK_GAP, nodesep: NODE_GAP, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));

  const satellites = satellitesByNode(input);
  const ids = Object.keys(input.nodes).sort();
  for (const id of ids) {
    const count = satellites.get(id)?.length ?? 0;
    const extra = count > 0 ? SATELLITE_TOP + count * (SATELLITE_HEIGHT + SATELLITE_GAP) - SATELLITE_GAP : 0;
    graph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT + extra });
  }
  const flow = input.edges.filter((edge) => edge.kind === "flow").sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of flow) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) graph.setEdge(edge.source, edge.target);
  }
  dagreLayout(graph);

  const positions: Record<string, Position> = {};
  let width = 0;
  let height = 0;
  for (const id of ids) {
    const node = graph.node(id);
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;
    positions[id] = { x, y };
    width = Math.max(width, x + node.width);
    height = Math.max(height, y + node.height);
    (satellites.get(id) ?? []).forEach((satelliteId, index) => {
      positions[satelliteId] = {
        x: x + SATELLITE_INDENT,
        y: y + NODE_HEIGHT + SATELLITE_TOP + index * (SATELLITE_HEIGHT + SATELLITE_GAP),
      };
    });
  }
  return { positions, width, height };
}
