"use client";

import { getBezierPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { memo, useEffect, useRef } from "react";
import { useRun, useRunStoreApi } from "@/features/run/store";
import { cn } from "@/lib/utils";
import { flowEdgeState, toolEdgeState, type EdgeState } from "./graph-model";
import { launchPacket } from "./packets";

// Edges show state (design §1 signature 1): a dotted gray edge waits, a dotted
// blue edge that moves carries work, a solid edge delivered its data.

export type StateEdgeData = { kind: "flow" | "tool" };

/** Packets already launched for each run view, so a remounted edge never replays one. */
const launchedByStore = new WeakMap<object, Set<string>>();

const STROKE: Record<EdgeState, string> = {
  waiting: "stroke-muted-foreground/40 [stroke-dasharray:1_5]",
  active: "stroke-live [stroke-dasharray:1_5] animate-edge-flow motion-reduce:animate-none",
  delivered: "stroke-muted-foreground/50",
  failed: "stroke-destructive/50 [stroke-dasharray:1_5]",
};

export const StateEdge = memo(function StateEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const kind = (data as StateEdgeData | undefined)?.kind ?? "flow";
  const state = useRun((store) =>
    kind === "tool" ? toolEdgeState(store.view.satellites[target]) : flowEdgeState(store.view.nodes[source]),
  );
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const pathRef = useRef<SVGPathElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const store = useRunStoreApi();
  const reduced = useReducedMotion();

  // Launch the packets of this edge that are newer than the loaded history.
  useEffect(() => {
    if (reduced) return;
    let seen = launchedByStore.get(store);
    if (!seen) {
      seen = new Set<string>();
      launchedByStore.set(store, seen);
    }
    const launched = seen;
    const check = (packets: ReturnType<typeof store.getState>["view"]["packets"], floor: number) => {
      for (const packet of packets) {
        if (packet.edgeId !== id || packet.seq <= floor || launched.has(packet.id)) continue;
        launched.add(packet.id);
        if (pathRef.current && layerRef.current) launchPacket(packet, pathRef.current, layerRef.current);
      }
    };
    // A new tool edge mounts after the event that also made its first packet.
    const initial = store.getState();
    check(initial.view.packets, initial.animateFrom);
    return store.subscribe((state, previous) => {
      if (state.view.packets !== previous.view.packets) check(state.view.packets, state.animateFrom);
    });
  }, [id, reduced, store]);

  return (
    <g>
      <path
        ref={pathRef}
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        className={cn("transition-[stroke] duration-150", STROKE[state])}
      />
      <g ref={layerRef} />
    </g>
  );
});
