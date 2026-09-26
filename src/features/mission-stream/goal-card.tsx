"use client";

import { IconPlayerStopFilled } from "@tabler/icons-react";
import { useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/components/icon-button";
import { useMissionMeta, useMissionStatus } from "@/features/run/mission-meta";
import { StopDialog } from "@/features/run/stop-dialog";
import { isMissionActive } from "@/shared/events";
import { cn } from "@/lib/utils";

/** The goal, with Stop while the mission is active (FR-18, design §6.3). */
export function GoalCard() {
  const meta = useMissionMeta();
  const { status } = useMissionStatus();
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const active = isMissionActive(status);

  // Show "Show more" only when the goal is longer than 3 lines.
  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, meta.goal]);

  return (
    <div className="flex items-start gap-2 rounded-xl bg-card p-3 shadow-raised">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p
          ref={textRef}
          className={cn("text-sm whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]", !expanded && "line-clamp-3")}
        >
          {meta.goal}
        </p>
        {(clamped || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="text-xs text-link underline-offset-2 hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      {active && (
        <>
          <IconButton label="Stop mission" variant="default" className="shrink-0" onClick={() => setConfirming(true)}>
            <IconPlayerStopFilled />
          </IconButton>
          <StopDialog missionId={meta._id} open={confirming} onOpenChange={setConfirming} />
        </>
      )}
    </div>
  );
}
