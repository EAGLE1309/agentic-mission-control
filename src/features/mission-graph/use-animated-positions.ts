"use client";

import { animate } from "motion";
import { useEffect, useRef, useState } from "react";
import type { Position } from "@/shared/layout";

type Positions = Record<string, Position>;

function samePositions(a: Positions, b: Positions): boolean {
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  return keys.every((key) => a[key] && a[key].x === b[key].x && a[key].y === b[key].y);
}

/**
 * Node positions that move to the layout with one spring (design §6.4:
 * duration 0.45, bounce 0). React Flow gets each frame, so edges follow the
 * nodes. New nodes start at the position of their parent. The first layout,
 * and all layouts with reduced motion, jump.
 */
export function useAnimatedPositions(
  targets: Positions,
  parentOf: (id: string) => string | undefined,
  reduced: boolean,
): Positions {
  const [positions, setPositions] = useState<Positions>(targets);
  const current = useRef<Positions>(targets);
  const parentRef = useRef(parentOf);
  useEffect(() => {
    parentRef.current = parentOf;
  });

  useEffect(() => {
    const previous = current.current;
    if (samePositions(previous, targets)) return;

    const first = Object.keys(previous).length === 0;
    if (first || reduced) {
      current.current = targets;
      const frame = requestAnimationFrame(() => setPositions(targets));
      return () => cancelAnimationFrame(frame);
    }

    const from: Positions = {};
    for (const [id, target] of Object.entries(targets)) {
      const parent = parentRef.current(id);
      from[id] = previous[id] ?? (parent ? (previous[parent] ?? targets[parent]) : undefined) ?? target;
    }
    const controls = animate(0, 1, {
      type: "spring",
      duration: 0.45,
      bounce: 0,
      onUpdate: (progress) => {
        const next: Positions = {};
        for (const [id, target] of Object.entries(targets)) {
          const start = from[id];
          next[id] = { x: start.x + (target.x - start.x) * progress, y: start.y + (target.y - start.y) * progress };
        }
        current.current = next;
        setPositions(next);
      },
      onComplete: () => {
        current.current = targets;
        setPositions(targets);
      },
    });
    return () => controls.stop();
  }, [targets, reduced]);

  return positions;
}
