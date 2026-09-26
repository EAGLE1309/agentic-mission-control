"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { TOOL_ICON } from "@/components/agent-icons";
import { useRun } from "@/features/run/store";
import { SATELLITE_HEIGHT } from "@/shared/layout";

/** One tool of one task (tech spec §6.3, design §6.4). */
export const SatelliteNode = memo(function SatelliteNode({ id }: NodeProps) {
  const satellite = useRun((state) => state.view.satellites[id]);
  if (!satellite) return null;
  const Icon = TOOL_ICON[satellite.tool];
  return (
    <div
      // The chip sizes to its content. React Flow gets an estimate for layout only:
      // the edge ends at the left handle, so the real width does not move it.
      style={{ height: SATELLITE_HEIGHT }}
      className="flex w-max items-center gap-1.5 rounded-md bg-card px-2 shadow-raised animate-node-enter motion-reduce:animate-none"
    >
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} />
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="font-mono text-xs whitespace-nowrap text-foreground">{satellite.tool}</span>
      <span className="text-xs text-muted-foreground tabular-nums">×{satellite.calls}</span>
    </div>
  );
});
