"use client";

import { api } from "@convex/_generated/api";
import { IconChevronDown } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { useState, useSyncExternalStore } from "react";
import { ROLE_ICON, TOOL_ICON } from "@/components/agent-icons";
import { CopyButton } from "@/components/copy-button";
import { ProviderMark, modelName, providerName } from "@/components/provider-mark";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShellData } from "@/features/shell/use-shell-data";
import { useNow } from "@/hooks/use-now";
import { AGENTS, TOOLS, type AgentRole, type AgentSpec } from "@/shared/agents";
import type { ModelProfile, ToolName } from "@/shared/events";
import { CATALOG_STALE_MS, MODEL_PRESETS } from "@/shared/models";

// Agents (FR-29, design §6.8): what each agent does, with which tools and
// models. Written for users; the instructions are one click away.

const TOOL_LABEL: Record<ToolName, string> = {
  web_search: "Searches the web",
  fetch_url: "Reads web pages",
  write_section: "Writes its section",
  app_search: "Searches your apps",
  app_write: "Creates pages and drafts in your apps",
};

const PROFILES: { value: ModelProfile; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "fast", label: "Fast" },
];

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function useHashRole(): AgentRole | null {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  return AGENTS.some((agent) => agent.role === hash) ? (hash as AgentRole) : null;
}

type ModelInfo = { name: string; state: "ready" | "gone" | "unknown" };

export function AgentsView() {
  const catalog = useQuery(api.catalog.models);
  const chains = useQuery(api.catalog.chains);
  const { activeRoles } = useShellData();
  const [profile, setProfile] = useState<ModelProfile>("balanced");
  const [toggled, setToggled] = useState<Partial<Record<AgentRole, boolean>>>({});
  const hashRole = useHashRole();
  const now = useNow(60_000);

  const byId = new Map((catalog ?? []).map((model) => [model.modelId, model]));
  const info = (modelId: string): ModelInfo => {
    const entry = byId.get(modelId);
    const state = !catalog || catalog.length === 0 ? "unknown" : entry && now - entry.lastSeenAt <= CATALOG_STALE_MS ? "ready" : "gone";
    return { name: modelName(modelId, entry?.name), state };
  };
  const chainFor = (role: AgentRole) => (chains?.[profile] ?? MODEL_PRESETS[profile])[role];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm text-pretty text-muted-foreground">
          The orchestrator plans each mission and hands the tasks to the other agents. The Librarian joins when you connect
          apps. When a model is busy or fails, the agent moves to the next model in its list.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span id="agents-model-label" className="text-xs text-muted-foreground">
            Model
          </span>
          <ToggleGroup
            aria-labelledby="agents-model-label"
            spacing={0}
            variant="segmented"
            size="xs"
            value={[profile]}
            onValueChange={(values: unknown[]) => {
              const next = values[0];
              if (next === "balanced" || next === "fast") setProfile(next);
            }}
            className="rounded-lg bg-muted p-0.5"
          >
            {PROFILES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value} className="rounded-md!">
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <ul className="divide-y rounded-lg bg-card shadow-raised">
        {AGENTS.map((agent) => {
          const open = toggled[agent.role] ?? hashRole === agent.role;
          return (
            <AgentRow
              key={agent.role}
              agent={agent}
              chain={chainFor(agent.role)}
              fromEnv={chains?.fromEnv.includes(agent.role) ?? false}
              running={activeRoles[agent.role] ?? 0}
              info={info}
              open={open}
              onOpenChange={(next) => setToggled((current) => ({ ...current, [agent.role]: next }))}
            />
          );
        })}
      </ul>
    </div>
  );
}

function AgentRow({
  agent,
  chain,
  fromEnv,
  running,
  info,
  open,
  onOpenChange,
}: {
  agent: AgentSpec;
  chain: readonly string[];
  fromEnv: boolean;
  running: number;
  info: (modelId: string) => ModelInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = ROLE_ICON[agent.role];
  const [first, ...fallbacks] = chain;
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <li id={agent.role} className="scroll-mt-16">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color] duration-150 hover:bg-accent first:rounded-t-lg">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-[background-color] duration-150 group-hover:bg-background">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{agent.name}</span>
              {running > 0 && (
                <Badge variant="live">
                  <span aria-hidden className="size-1.5 rounded-full bg-live" />
                  Working
                </Badge>
              )}
            </span>
            <span className="text-xs text-pretty text-muted-foreground">{agent.description}</span>
          </span>
          {first && <ModelSummary first={first} fallbacks={fallbacks} info={info} />}
          <IconChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col gap-5 px-4 pt-1 pb-4 sm:pl-16">
            <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
              <section className="flex flex-col gap-2" aria-label={`${agent.name} models`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs text-muted-foreground">Models, tried in order</h3>
                  {fromEnv && <Badge variant="neutral">Set by env</Badge>}
                </div>
                <ol className="flex flex-col">
                  {chain.map((modelId, index) => {
                    const model = info(modelId);
                    return (
                      <li key={modelId} className="flex h-8 items-center gap-2.5" title={modelId}>
                        <span className="w-4 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                        <ProviderMark modelId={modelId} />
                        <span className="truncate text-sm text-foreground">{model.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{providerName(modelId)}</span>
                        {model.state === "gone" && (
                          <Badge variant="warning" className="ml-auto">
                            Unavailable
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="flex flex-col gap-2" aria-label={`${agent.name} tools`}>
                <h3 className="text-xs text-muted-foreground">Tools</h3>
                {agent.tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {agent.role === "orchestrator" ? "No tools. It plans from your goal." : "No tools. It works from the task outputs."}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {agent.tools.map((tool) => {
                      const ToolIcon = TOOL_ICON[tool];
                      return (
                        <li key={tool} className="flex h-8 items-center gap-2.5" title={TOOLS.find((item) => item.name === tool)?.description}>
                          <ToolIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm text-foreground">{TOOL_LABEL[tool]}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
              <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger className="group flex h-8 items-center gap-1.5 rounded-md text-sm text-link underline-offset-2 hover:underline">
                  {showPrompt ? "Hide instructions" : "Show instructions"}
                </CollapsibleTrigger>
                {showPrompt && <CopyButton text={agent.prompt} label={`Copy the ${agent.name} instructions`} />}
              </div>
              <CollapsibleContent>
                <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap text-foreground">
                  {agent.prompt}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/** The first model, and the marks of the fallbacks stacked with "+N". */
function ModelSummary({ first, fallbacks, info }: { first: string; fallbacks: string[]; info: (modelId: string) => ModelInfo }) {
  const firstInfo = info(first);
  const shown = fallbacks.slice(0, 3);
  return (
    <span className="hidden shrink-0 items-center gap-2 sm:flex">
      <span className="flex h-7 max-w-52 items-center gap-1.5 rounded-md bg-muted px-2 transition-[background-color] duration-150 group-hover:bg-background">

        <ProviderMark modelId={first} className="size-3.5" />
        <span className="truncate text-xs text-foreground">{firstInfo.name}</span>
      </span>
      {fallbacks.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            className="flex h-7 items-center gap-1.5"
            aria-label={`Then ${fallbacks.map((id) => info(id).name).join(", ")}`}
          >
            {shown.map((modelId) => (
              <ProviderMark key={modelId} modelId={modelId} className="size-3.5" />
            ))}
            <span className="text-xs text-muted-foreground tabular-nums">+{fallbacks.length}</span>
          </TooltipTrigger>
          <TooltipContent>Then {fallbacks.map((id) => info(id).name).join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
