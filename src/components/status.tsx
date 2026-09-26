import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconClock,
  IconLoader2,
  IconPlayerStop,
  type Icon,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MissionStatus, NodeStatus } from "@/shared/events";

// The only map from a status to its label, icon, and tone (design §5.3).

export type Tone = "neutral" | "live" | "success" | "warning" | "destructive";

export type StatusKind =
  | "pending"
  | "queued"
  | "running"
  | "planning"
  | "assembling"
  | "done"
  | "ok"
  | "completed"
  | "partial"
  | "failed"
  | "killed"
  | "stopped";

type StatusSpec = { label: string; icon: Icon; tone: Tone; spins?: boolean };

const STATUS: Record<StatusKind, StatusSpec> = {
  pending: { label: "Waiting", icon: IconCircleDashed, tone: "neutral" },
  queued: { label: "Queued", icon: IconClock, tone: "neutral" },
  running: { label: "Running", icon: IconLoader2, tone: "live", spins: true },
  planning: { label: "Planning", icon: IconLoader2, tone: "live", spins: true },
  assembling: { label: "Writing report", icon: IconLoader2, tone: "live", spins: true },
  done: { label: "Done", icon: IconCircleCheck, tone: "success" },
  // A finished tool call is a routine step: it stays neutral.
  ok: { label: "Done", icon: IconCircleCheck, tone: "neutral" },
  completed: { label: "Completed", icon: IconCircleCheck, tone: "success" },
  partial: { label: "Partial", icon: IconAlertTriangle, tone: "warning" },
  failed: { label: "Failed", icon: IconCircleX, tone: "destructive" },
  killed: { label: "Stopped", icon: IconBan, tone: "neutral" },
  stopped: { label: "Stopped", icon: IconPlayerStop, tone: "neutral" },
};

/** A loader turns once each 800ms, and slower with reduced motion: a still loader looks broken. */
const SPIN = "animate-[spin_0.8s_linear_infinite] motion-reduce:animate-[spin_1.6s_linear_infinite]";

const ICON_TONE: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  live: "text-live",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function missionStatusKind(status: MissionStatus, partial = false): StatusKind {
  if (status === "completed" && partial) return "partial";
  return status;
}

export function nodeStatusKind(status: NodeStatus): StatusKind {
  return status;
}

export function statusSpec(kind: StatusKind): StatusSpec {
  return STATUS[kind];
}

/** A status icon. Its text goes to aria-label, so color is never the only signal. */
export function StatusIcon({
  status,
  className,
  label,
}: {
  status: StatusKind;
  className?: string;
  /** Overrides the aria-label, for example "Researcher task: Pricing, Running". */
  label?: string;
}) {
  const spec = STATUS[status];
  const Icon = spec.icon;
  return (
    <Icon
      key={status}
      role="img"
      aria-label={label ?? spec.label}
      className={cn(
        "size-4 shrink-0",
        ICON_TONE[spec.tone],
        // Both set `animation`, so a spinner skips the entrance fade: with it,
        // the one-shot fade replaced the spin and the loader stood still.
        spec.spins ? SPIN : "animate-in fade-in-0 zoom-in-95 duration-150 ease-out",
        className,
      )}
    />
  );
}

export function StatusBadge({ status, className }: { status: StatusKind; className?: string }) {
  const spec = STATUS[status];
  const Icon = spec.icon;
  return (
    <Badge variant={spec.tone} className={className}>
      <Icon
        aria-hidden
        className={cn(spec.spins && SPIN)}
      />
      {spec.label}
    </Badge>
  );
}
