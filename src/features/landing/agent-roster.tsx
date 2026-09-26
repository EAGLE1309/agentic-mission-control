import { AgentChip } from "@/components/agent-chip";
import { TOOL_ICON } from "@/components/agent-icons";
import type { ToolName } from "@/shared/events";
import type { NodeRole } from "@/shared/plan";

// The built-in agents and the tools each one can call (convex/engine/tools/registry.ts).

const ROSTER: { role: NodeRole; text: string; tools: ToolName[] }[] = [
  {
    role: "orchestrator",
    text: "Reads the goal and splits it into tasks, with the order they run in.",
    tools: [],
  },
  {
    role: "researcher",
    text: "Searches the web, reads the best pages, and writes up what it found.",
    tools: ["web_search", "fetch_url", "write_section"],
  },
  {
    role: "librarian",
    text: "Searches your connected apps. When you allow it, it also creates drafts, pages, and issues.",
    tools: ["app_search", "app_write", "write_section"],
  },
  {
    role: "writer",
    text: "Combines the research into one part: a comparison, a table, or a recommendation.",
    tools: ["write_section"],
  },
  {
    role: "assembler",
    text: "Merges the parts into one report and lists every source.",
    tools: [],
  },
];

export function AgentRoster() {
  return (
    <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-raised">
      {ROSTER.map((agent) => (
        <li key={agent.role} className="grid gap-3 p-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-6 sm:p-5">
          <div>
            <AgentChip role={agent.role} />
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm leading-relaxed text-pretty text-foreground">{agent.text}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {agent.tools.length === 0 ? (
                <span className="text-xs text-muted-foreground">No tools: it works from the model alone.</span>
              ) : (
                agent.tools.map((tool) => {
                  const Icon = TOOL_ICON[tool];
                  return (
                    <span
                      key={tool}
                      className="inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.5 font-mono text-[11px] text-muted-foreground"
                    >
                      <Icon aria-hidden className="size-3" />
                      {tool}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
