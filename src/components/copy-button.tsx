"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/icon-button";
import { cn } from "@/lib/utils";

/**
 * Copy (design §5.7): the icon changes to a check for 1.5s, and a polite
 * live region says "Copied". No toast.
 */
export function CopyButton({
  text,
  label = "Copy",
  size = "icon-xs",
  className,
}: {
  text: string | (() => string | Promise<string>);
  label?: string;
  size?: "icon-xs" | "icon-sm";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1_500);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      const value = typeof text === "function" ? await text() : text;
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <>
      <IconButton label={label} size={size} className={cn("shrink-0", className)} onClick={() => void copy()}>
        {state === "copied" ? <IconCheck /> : <IconCopy />}
      </IconButton>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "The text was not copied" : ""}
      </span>
    </>
  );
}
