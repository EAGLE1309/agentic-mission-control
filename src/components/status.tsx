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

export type Tone = "neutral" | "live" | "warning" | "destructive";

export type StatusKind =
  | "pending"
  | "queued"
  | "running"
  | "planning"
  | "assembling"
  | "done"
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
  done: { label: "Done", icon: IconCircleCheck, tone: "neutral" },
  completed: { label: "Completed", icon: IconCircleCheck, tone: "neutral" },
  partial: { label: "Partial", icon: IconAlertTriangle, tone: "warning" },
  failed: { label: "Failed", icon: IconCircleX, tone: "destructive" },
  killed: { label: "Stopped", icon: IconBan, tone: "neutral" },
  stopped: { label: "Stopped", icon: IconPlayerStop, tone: "neutral" },
};

const ICON_TONE: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  live: "text-live",
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
        "size-4 shrink-0 animate-in fade-in-0 zoom-in-95 duration-150 ease-out",
        ICON_TONE[spec.tone],
        spec.spins && "animate-[spin_0.8s_linear_infinite] motion-reduce:animate-none",
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
        className={cn(spec.spins && "animate-[spin_0.8s_linear_infinite] motion-reduce:animate-none")}
      />
      {spec.label}
    </Badge>
  );
}
