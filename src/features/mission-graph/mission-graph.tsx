"use client";

import "@xyflow/react/dist/base.css";
import { IconLayoutSidebar } from "@tabler/icons-react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { IconButton } from "@/components/icon-button";
import { TracePanel } from "@/features/trace/trace-panel";
import { useRun, useRunStoreApi } from "@/features/run/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { isMissionActive } from "@/shared/events";
import { NODE_HEIGHT, NODE_WIDTH, SATELLITE_HEIGHT, layoutGraph, layoutKey, satelliteWidth, type Position } from "@/shared/layout";
import { REPORT_ID } from "@/shared/plan";
import type { MissionView } from "@/shared/reducer";
import { labelsKey, nodeAriaLabel, runningKey, spawnParent } from "./graph-model";
import { GraphControls } from "./graph-controls";
import { SatelliteNode } from "./satellite-node";
import { StateEdge, type StateEdgeData } from "./state-edge";
import { TaskNode } from "./task-node";
import { useAnimatedPositions } from "./use-animated-positions";

const nodeTypes = { task: TaskNode, satellite: SatelliteNode };
const edgeTypes = { state: StateEdge };

const FOLLOW_INTERVAL_MS = 1_500;
const TRACE_WIDTH = 440;

function buildNodes(view: MissionView, positions: Record<string, Position>): Node[] {
  // Plan order, so Tab moves between tasks in plan order (design §7).
  const tasks: Node[] = view.nodeOrder.map((id) => ({
    id,
    type: "task",
    position: positions[id] ?? { x: 0, y: 0 },
    data: {},
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    // With measured set, React Flow keeps the handle bounds when positions change
    // each frame. Without it, every update hides all edges until a new measure.
    measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: true,
    ariaLabel: nodeAriaLabel(view.nodes[id]),
  }));
  const satellites: Node[] = Object.values(view.satellites).map((satellite) => ({
    id: satellite.id,
    type: "satellite",
    position: positions[satellite.id] ?? positions[satellite.nodeId] ?? { x: 0, y: 0 },
    data: {},
    // Fixed sizes: React Flow draws a node and its edges only after it knows the size.
    width: satelliteWidth(satellite.tool, satellite.calls),
    height: SATELLITE_HEIGHT,
    measured: { width: satelliteWidth(satellite.tool, satellite.calls), height: SATELLITE_HEIGHT },
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
  }));
  return [...tasks, ...satellites];
}

function buildEdges(view: MissionView): Edge[] {
  return view.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "state",
    sourceHandle: edge.kind === "tool" ? "tools" : "flow",
    targetHandle: "in",
    focusable: false,
    selectable: false,
    data: { kind: edge.kind } satisfies StateEdgeData,
  }));
}

/**
 * The live graph. With interactive false (the landing demo), a click selects
 * nothing and no trace panel or stream toggle shows: those parts use Convex.
 */
export function MissionGraph({ interactive = true }: { interactive?: boolean }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas interactive={interactive} />
    </ReactFlowProvider>
  );
}

function GraphCanvas({ interactive }: { interactive: boolean }) {
  const store = useRunStoreApi();
  const flow = useReactFlow();
  const reduced = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  const key = useRun((state) => layoutKey(state.view));
  const labels = useRun((state) => labelsKey(state.view));
  const running = useRun((state) => runningKey(state.view));
  const active = useRun((state) => isMissionActive(state.view.status));
  const follow = useRun((state) => state.followMode);
  const selected = useRun((state) => state.selectedNodeId);
  const streamOpen = useRun((state) => state.streamOpen);
  const toggleStream = useRun((state) => state.toggleStream);
  const setFollowMode = useRun((state) => state.setFollowMode);
  const openTrace = useRun((state) => state.openTrace);
  const select = useRun((state) => state.select);
  const setTab = useRun((state) => state.setTab);
  const containerRef = useRef<HTMLDivElement>(null);

  // The layout runs only when nodes, edges, or satellites change (tech spec §9.3).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutGraph(store.getState().view), [key, store]);
  const parentOf = useCallback((id: string) => spawnParent(store.getState().view, id), [store]);
  // Only task nodes move on the spring. Satellites keep a fixed offset from their
  // task, so they move with it and never cross a card while it moves.
  const taskTargets = useMemo(
    () => Object.fromEntries(Object.entries(layout.positions).filter(([id]) => !store.getState().view.satellites[id])),
    [layout, store],
  );
  const taskPositions = useAnimatedPositions(taskTargets, parentOf, reduced);
  const positions = useMemo(() => {
    const next: Record<string, Position> = { ...taskPositions };
    for (const satellite of Object.values(store.getState().view.satellites)) {
      const target = layout.positions[satellite.id];
      const parentTarget = layout.positions[satellite.nodeId];
      const parent = taskPositions[satellite.nodeId];
      if (target && parentTarget && parent) {
        next[satellite.id] = { x: parent.x + target.x - parentTarget.x, y: parent.y + target.y - parentTarget.y };
      }
    }
    return next;
  }, [taskPositions, layout, store]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nodes = useMemo(() => buildNodes(store.getState().view, positions), [positions, labels, store]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const edges = useMemo(() => buildEdges(store.getState().view), [key, store]);

  const duration = reduced ? 0 : 400;
  const fitAll = useCallback(
    (animated = true) => flow.fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.25, duration: animated ? duration : 0 }),
    [flow, duration],
  );

  // First view: fit all nodes, 25% to 100% zoom.
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (fittedOnce.current || nodes.length === 0) return;
    fittedOnce.current = true;
    const frame = requestAnimationFrame(() => void fitAll(false));
    return () => cancelAnimationFrame(frame);
  }, [nodes.length, fitAll]);

  // Follow mode: keep the running tasks in view, once each 1.5s at most.
  const lastFollow = useRef(0);
  useEffect(() => {
    if (!follow) return;
    const ids = running ? running.split(",") : [];
    const wait = Math.max(500, lastFollow.current + FOLLOW_INTERVAL_MS - Date.now());
    const timer = setTimeout(() => {
      lastFollow.current = Date.now();
      if (ids.length > 0) {
        void flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, maxZoom: 1, minZoom: 0.25, duration });
      } else if (!active) {
        void fitAll();
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [follow, running, key, active, flow, duration, fitAll]);

  // Keep the selected node in view, to the left of the trace panel.
  useEffect(() => {
    if (!selected || isMobile) return;
    const node = flow.getNode(selected);
    const container = containerRef.current;
    if (!node || !container) return;
    const { zoom } = flow.getViewport();
    const width = container.clientWidth;
    const center = { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_HEIGHT / 2 };
    const screen = flow.flowToScreenPosition(center);
    const bounds = container.getBoundingClientRect();
    const right = bounds.left + width - TRACE_WIDTH - 24;
    if (screen.x > bounds.left + 24 && screen.x < right) return;
    void flow.setCenter(center.x + TRACE_WIDTH / 2 / zoom, center.y, { zoom, duration });
  }, [selected, isMobile, flow, duration]);

  const focusNode = (id: string) => {
    const element = containerRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    element?.focus();
  };

  const activate = (id: string) => {
    if (!interactive) return;
    if (id === REPORT_ID && store.getState().view.versions.length > 0) {
      setTab("report");
      store.getState().setMobilePane("report");
      return;
    }
    if (!store.getState().view.nodes[id]) return;
    setFollowMode(false);
    openTrace(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable='true']") || event.metaKey || event.ctrlKey || event.altKey) return;
    const nodeId = target.closest<HTMLElement>(".react-flow__node")?.dataset.id;
    switch (event.key) {
      case "Enter":
        if (nodeId && store.getState().view.nodes[nodeId]) {
          event.preventDefault();
          activate(nodeId);
        }
        return;
      case "Escape":
        if (selected) {
          event.preventDefault();
          select(null);
          focusNode(selected);
        }
        return;
      case "=":
      case "+":
        event.preventDefault();
        setFollowMode(false);
        void flow.zoomIn({ duration });
        return;
      case "-":
        event.preventDefault();
        setFollowMode(false);
        void flow.zoomOut({ duration });
        return;
      case "f":
      case "F":
        event.preventDefault();
        setFollowMode(false);
        void fitAll();
        return;
      case "l":
      case "L":
        event.preventDefault();
        setFollowMode(!store.getState().followMode);
        return;
    }
  };

  return (
    // The keyboard handler serves the whole canvas: nodes, controls, and trace.
    <div ref={containerRef} className="absolute inset-0" onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable
        edgesFocusable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.25}
        maxZoom={1.5}
        onNodeClick={(_, node) => activate(node.id)}
        onPaneClick={() => select(null)}
        onMoveStart={(event) => {
          // A pan or zoom by the user turns follow mode off. Programmatic moves have no event.
          if (event) setFollowMode(false);
        }}
        aria-label="Mission graph"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--canvas-dot)" />
      </ReactFlow>

      {interactive && (
      <div className="absolute top-2 left-2 z-20 hidden md:block">
        <IconButton label={streamOpen ? "Hide stream" : "Show stream"} side="right" onClick={toggleStream}>
          <IconLayoutSidebar />
        </IconButton>
      </div>
      )}

      <GraphControls
        follow={follow}
        onZoomIn={() => {
          setFollowMode(false);
          void flow.zoomIn({ duration });
        }}
        onZoomOut={() => {
          setFollowMode(false);
          void flow.zoomOut({ duration });
        }}
        onResetZoom={() => {
          setFollowMode(false);
          void flow.zoomTo(1, { duration });
        }}
        onFit={() => {
          setFollowMode(false);
          void fitAll();
        }}
        onToggleFollow={() => setFollowMode(!follow)}
      />

      {interactive && <TracePanel onClose={(id) => focusNode(id)} />}
    </div>
  );
}
