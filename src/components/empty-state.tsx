import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * Empty and error states (design §5.8): an icon tile, a heading, one line of
 * text, and one action. Give it the min height of the full state, so the
 * layout does not jump when data arrives.
 */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  action,
  className,
}: {
  icon: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("p-8", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconComponent aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription className="text-pretty">{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
