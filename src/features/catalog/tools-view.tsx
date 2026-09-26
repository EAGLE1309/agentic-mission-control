"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { TOOL_ICON } from "@/components/agent-icons";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TOOLS, agentsUsingTool } from "@/shared/agents";

/** Tools (FR-29, design §6.8): read-only rows. A row opens to show the input schema. */
export function ToolsView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <p className="mb-4 text-sm text-pretty text-muted-foreground">
        The built-in tools of the agents. All tools only read: an agent can search and read the web, and write its section.
      </p>
      <ul className="divide-y">
        {TOOLS.map((tool) => {
          const Icon = TOOL_ICON[tool.name];
          return (
            <li key={tool.name}>
              <Collapsible>
                <CollapsibleTrigger className="group flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-[background-color] duration-150 hover:bg-accent">
                  <IconChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-90 motion-reduce:transition-none"
                  />
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="w-32 shrink-0 font-mono text-xs text-foreground">{tool.name}</span>
                  <span className="min-w-0 flex-1 text-sm text-pretty text-muted-foreground">{tool.description}</span>
                  <span className="hidden shrink-0 gap-1 sm:flex">
                    {agentsUsingTool(tool.name).map((agent) => (
                      <Badge key={agent.role} variant="neutral">
                        {agent.name}
                      </Badge>
                    ))}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-1 px-3 pb-4 pl-10">
                    <div className="flex h-6 items-center justify-between">
                      <span className="text-xs text-muted-foreground">Input schema</span>
                      <CopyButton text={tool.inputSchema} label="Copy input schema" />
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">{tool.inputSchema}</pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
