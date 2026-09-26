"use client";

import type { ComponentProps } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Segmented control look for Tabs (design §5.6). The selection changes at
// once: no sliding indicator, no animation.

export function SegmentedTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  return <TabsList className={cn("h-8 gap-0 rounded-lg bg-muted p-0.5 group-data-horizontal/tabs:h-8", className)} {...props} />;
}

export function SegmentedTab({ className, ...props }: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "h-7 flex-none rounded-md px-2.5 text-sm font-normal text-muted-foreground transition-none hover:text-foreground",
        "data-active:bg-background data-active:text-foreground data-active:shadow-raised",
        "dark:data-active:border-transparent dark:data-active:bg-background",
        "disabled:pointer-events-none disabled:opacity-50",
        "after:hidden",
        className,
      )}
      {...props}
    />
  );
}
