"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useRun } from "@/features/run/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { TraceContent } from "./trace-content";

/**
 * The trace panel (design §6.3): inside the canvas and not modal, so the graph
 * stays in use. A click on another task changes the content at once. Below
 * 768px it is a bottom drawer.
 */
export function TracePanel({ onClose }: { onClose: (nodeId: string) => void }) {
  const selected = useRun((state) => state.selectedNodeId);
  const select = useRun((state) => state.select);
  const isMobile = useIsMobile();
  // Keep the last task while the panel slides out.
  const [shown, setShown] = useState(selected);
  if (selected && selected !== shown) setShown(selected);

  const close = () => {
    if (!selected) return;
    select(null);
    onClose(selected);
  };

  if (isMobile) {
    return (
      <Drawer open={selected !== null} onOpenChange={(open) => !open && close()}>
        <DrawerContent className="h-[90dvh] max-h-[90dvh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Task trace</DrawerTitle>
            <DrawerDescription>Steps, tool calls, and errors of the task.</DrawerDescription>
          </DrawerHeader>
          {shown && <TraceContent nodeId={shown} onClose={close} focusTitle={false} />}
        </DrawerContent>
      </Drawer>
    );
  }

  const open = selected !== null;
  return (
    <aside
      aria-label="Task trace"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "absolute inset-y-1 right-1 z-20 w-[440px] max-w-[calc(100%-0.5rem)] overflow-hidden rounded-lg bg-popover shadow-overlay",
        "transition-transform ease-drawer motion-reduce:transition-none",
        open ? "translate-x-0 duration-240" : "translate-x-[calc(100%+0.5rem)] duration-180",
      )}
    >
      {shown && <TraceContent nodeId={shown} onClose={close} focusTitle={open} />}
    </aside>
  );
}
