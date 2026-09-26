"use client";

import { IconCurrentLocation, IconMaximize, IconMinus, IconPlus } from "@tabler/icons-react";
import { useViewport } from "@xyflow/react";
import { IconButton } from "@/components/icon-button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Graph controls (FR-23, design §6.3): zoom, zoom level, fit view, follow mode. */
export function GraphControls({
  follow,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
  onToggleFollow,
}: {
  follow: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
  onToggleFollow: () => void;
}) {
  const { zoom } = useViewport();
  return (
    <div
      role="toolbar"
      aria-label="Graph controls"
      className="absolute bottom-3 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center gap-0.5 rounded-lg bg-card p-0.5 shadow-raised"
    >
      <IconButton label="Zoom out" shortcut="-" side="top" className="size-7" onClick={onZoomOut}>
        <IconMinus />
      </IconButton>
      <button
        type="button"
        onClick={onResetZoom}
        aria-label={`Zoom ${Math.round(zoom * 100)}%. Set to 100%.`}
        className="h-7 w-12 rounded-md text-xs text-muted-foreground tabular-nums transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton label="Zoom in" shortcut="=" side="top" className="size-7" onClick={onZoomIn}>
        <IconPlus />
      </IconButton>
      <Separator orientation="vertical" className="mx-0.5 h-4" />
      <IconButton label="Fit view" shortcut="F" side="top" className="size-7" onClick={onFit}>
        <IconMaximize />
      </IconButton>
      <IconButton
        label={follow ? "Follow mode is on" : "Follow mode is off"}
        shortcut="L"
        side="top"
        aria-pressed={follow}
        className={cn("size-7", follow && "bg-live-subtle text-live hover:bg-live-subtle hover:text-live")}
        onClick={onToggleFollow}
      >
        <IconCurrentLocation />
      </IconButton>
    </div>
  );
}
