"use client";

import { IconDeviceDesktop, IconEdit, IconHistory, IconMoon, IconSun, IconTemplate } from "@tabler/icons-react";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounced } from "@/hooks/use-debounced";
import { TEMPLATES } from "@/shared/templates";
import { PAGES } from "./nav";
import { useShell } from "./shell-context";
import { useShellData } from "./use-shell-data";

/** Each typed word must appear in the item. Fuzzy matching put "dark theme" first for "market". */
function matchWords(value: string, search: string, keywords?: string[]): number {
  const haystack = [value, ...(keywords ?? [])].join(" ").toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word)) ? 1 : 0;
}

const THEME_ITEMS = [
  { value: "system", label: "Use system theme", icon: IconDeviceDesktop },
  { value: "light", label: "Use light theme", icon: IconSun },
  { value: "dark", label: "Use dark theme", icon: IconMoon },
] as const;

/** Command palette (FR-6, design §6.13). It opens and closes with no animation. */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useShell();
  const { recentMissions } = useShellData();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // The search also finds missions by goal (FR-6).
  const term = useDebounced(query.trim(), 200);
  const found = useQuery(api.missions.search, paletteOpen && term.length >= 2 ? { query: term } : "skip") ?? [];
  const recent = recentMissions.filter((mission) => !found.some((item) => item.id === mission.id));

  const onOpenChange = (open: boolean) => {
    setPaletteOpen(open);
    if (!open) setQuery("");
  };

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Open pages, templates, and missions."
      className="top-[20vh] sm:max-w-[560px] data-closed:animate-none data-open:animate-none"
    >
      <Command filter={matchWords}>
        <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} aria-label="Search pages, templates, and missions" />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty className="text-muted-foreground">No results for “{query.trim()}”.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem value="action:new-mission" keywords={["New mission", "start", "goal"]} onSelect={() => run(() => router.push("/home"))}>
              <IconEdit aria-hidden />
              New mission
            </CommandItem>
            {THEME_ITEMS.map((item) => (
              <CommandItem
                key={item.value}
                value={`action:theme-${item.value}`}
                keywords={[item.label, "theme", "change theme", "appearance"]}
                data-checked={theme === item.value}
                onSelect={() => run(() => setTheme(item.value))}
              >
                <item.icon aria-hidden />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {found.length > 0 && (
            <CommandGroup heading="Missions">
              {found.map((mission) => (
                <CommandItem
                  key={mission.id}
                  value={`found:${mission.id}`}
                  keywords={[mission.title, mission.goal, term]}
                  onSelect={() => run(() => router.push(`/missions/${mission.id}`))}
                >
                  <IconHistory aria-hidden />
                  <span className="truncate">{mission.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {recent.length > 0 && (
            <CommandGroup heading="Recent missions">
              {recent.slice(0, 5).map((mission) => (
                <CommandItem
                  key={mission.id}
                  value={`mission:${mission.id}`}
                  keywords={[mission.title]}
                  onSelect={() => run(() => router.push(`/missions/${mission.id}`))}
                >
                  <IconHistory aria-hidden />
                  <span className="truncate">{mission.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Templates">
            {TEMPLATES.map((template) => (
              <CommandItem
                key={template.id}
                value={`template:${template.id}`}
                keywords={[template.title, "template"]}
                onSelect={() => run(() => router.push(`/home?template=${template.id}`))}
              >
                <IconTemplate aria-hidden />
                <span className="truncate">{template.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Pages">
            {PAGES.filter((page) => page.href !== "/home").map((page) => (
              <CommandItem
                key={page.href}
                value={`page:${page.href}`}
                keywords={[page.label, "go to", "open"]}
                onSelect={() => run(() => router.push(page.href))}
              >
                <page.icon aria-hidden />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
