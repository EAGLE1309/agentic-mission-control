"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const subscribe = () => () => {};

/** Theme segmented control (FR-7, design §5.6). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The theme is unknown on the server. Show no selection until the client knows it.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : null;

  return (
    <ToggleGroup
      aria-label="Theme"
      spacing={0}
      variant="segmented"
      size="xs"
      value={current ? [current] : []}
      onValueChange={(values: unknown[]) => {
        const next = values[0];
        if (typeof next === "string") setTheme(next);
      }}
      className={cn("w-full rounded-lg bg-muted p-0.5", className)}
    >
      {THEMES.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value} className="flex-1 rounded-md!">
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
