import { ROLE_ICON, ROLE_LABEL } from "@/components/agent-icons";
import { cn } from "@/lib/utils";
import type { NodeRole } from "@/shared/plan";

/** An agent named in a row or a header (design §5.3): a blue tinted chip with the agent icon. */
export function AgentChip({ role, className }: { role: NodeRole; className?: string }) {
  const Icon = ROLE_ICON[role];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-live-subtle px-1.5 text-xs font-medium text-live ring-1 ring-live-border/60 ring-inset",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {ROLE_LABEL[role]}
    </span>
  );
}
