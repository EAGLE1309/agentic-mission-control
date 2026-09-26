"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * An icon-only button with an aria-label and a tooltip (design §4). A button
 * with a shortcut shows the Kbd in its tooltip (design §7).
 */
export function IconButton({
  label,
  shortcut,
  side = "bottom",
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "children"> & {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  /** The icon. A trigger that wraps this button can pass it instead. */
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant={variant} size={size} aria-label={label} {...props} />}>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
