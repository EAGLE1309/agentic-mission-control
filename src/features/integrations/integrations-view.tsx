"use client";

import { api } from "@convex/_generated/api";
import { IconCheck, IconChevronDown, IconCircleCheck, IconLayoutGrid, IconPlugConnectedX, type Icon } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { AgentChip } from "@/components/agent-chip";
import { TOOL_ICON } from "@/components/agent-icons";
import { AppMark } from "@/components/app-mark";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { BrandMark, modelName, providerName } from "@/components/provider-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { TOOLS, agentsUsingTool } from "@/shared/agents";
import { APPS, APP_CATEGORIES, type AppCategory, type AppSlug } from "@/shared/apps";
import type { ToolName } from "@/shared/events";
import { CATALOG_STALE_MS, MODEL_PRESETS } from "@/shared/models";
import {
  SERVICES,
  STATE_BADGE,
  TOOL_UI,
  isLive,
  service,
  toolState,
  type Service,
  type ServiceStatus,
  type State,
} from "./catalog";
import { ConnectionMap } from "./connection-map";
import { useApps } from "./use-apps";

// Integrations (FR-29, design §6.8): the tools of the agents, the services
// behind them, the apps a user connects through Composio, and sign-in.

type Category = "tools" | "models" | "web" | AppCategory | "signin";
type Filter = "all" | "connected" | Category;

type Provider = { brand: string; models: string[] };

/** The model makers in the chains of both profiles, in order of first use. */
function useProviders(): { providers: Provider[]; freeModels: number } {
  const chains = useQuery(api.catalog.chains);
  const catalog = useQuery(api.catalog.models);
  const now = useNow(60_000);
  const names = new Map((catalog ?? []).map((model) => [model.modelId, model.name]));
  const byBrand = new Map<string, Map<string, string>>();
  for (const profile of ["balanced", "fast"] as const) {
    const profileChains = chains?.[profile] ?? MODEL_PRESETS[profile];
    for (const chain of Object.values(profileChains)) {
      for (const modelId of chain) {
        const brand = modelId.split("/")[0] ?? modelId;
        if (brand === "openrouter") continue;
        const models = byBrand.get(brand) ?? new Map<string, string>();
        models.set(modelId, modelName(modelId, names.get(modelId)));
        byBrand.set(brand, models);
      }
    }
  }
  const providers = [...byBrand].map(([brand, models]) => ({ brand, models: [...new Set(models.values())] }));
  const freeModels = (catalog ?? []).filter((model) => now - model.lastSeenAt <= CATALOG_STALE_MS).length;
  return { providers, freeModels };
}

export function IntegrationsView() {
  const status = useQuery(api.integrations.status);
  const { providers, freeModels } = useProviders();
  const apps = useApps(status?.composio);
  const [filter, setFilter] = useState<Filter>("all");

  const choose = (next: Filter) => {
    setFilter(next);
    // The new list starts at the top of the page.
    window.scrollTo({ top: 0 });
  };

  if (!status) {
    return (
      <div aria-busy="true" className="flex">
        <div className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 border-r md:block" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-6 md:px-8">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const openRouterState = service("openrouter").state(status);
  const readyTools = TOOLS.filter((tool) => isLive(toolState(tool.name, status))).length;
  const webServices = SERVICES.filter((item) => item.section === "web");
  const signInServices = SERVICES.filter((item) => item.section === "signin");
  const live = {
    tools: readyTools,
    models: isLive(openRouterState) ? 1 + providers.length : 0,
    web: webServices.filter((item) => isLive(item.state(status))).length,
    signin: signInServices.filter((item) => isLive(item.state(status))).length,
    apps: apps.connected.size,
  };
  const connectedCount = live.tools + live.models + live.web + live.signin + live.apps;

  const appCount = (category: AppCategory, onlyConnected = false) =>
    APPS.filter((app) => app.category === category && (!onlyConnected || apps.connected.has(app.slug))).length;
  const counts: Record<Category, number> = {
    tools: TOOLS.length,
    models: 1 + providers.length,
    web: webServices.length,
    signin: signInServices.length,
    ...(Object.fromEntries(APP_CATEGORIES.map((category) => [category.id, appCount(category.id)])) as Record<AppCategory, number>),
  };

  const onlyLive = filter === "connected";
  const show = (category: Category, liveCount: number) => filter === "all" || filter === category || (onlyLive && liveCount > 0);
  const appCategories = APP_CATEGORIES.filter((category) => show(category.id, appCount(category.id, true)));
  const nav = <FilterNav filter={filter} onChange={choose} counts={counts} connected={connectedCount} />;

  return (
    <div className="flex">
      <aside
        aria-label="Integration categories"
        className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 overflow-y-auto border-r px-3 py-4 md:block"
      >
        {nav}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-6 md:px-8">
          <div className="-mx-4 overflow-x-auto px-4 md:hidden">{nav}</div>

          <ConnectionMap
            status={status}
            providers={providers.map((provider) => provider.brand)}
            freeModels={freeModels}
            apps={APPS.filter((app) => apps.connected.has(app.slug)).map((app) => app.slug)}
          />

          {onlyLive && connectedCount === 0 && (
            <EmptyState
              icon={IconPlugConnectedX}
              title="Nothing is connected yet"
              description="Add an OpenRouter key to run live missions, or connect an app."
              action={
                <Button size="sm" variant="outline" onClick={() => choose("all")}>
                  Show all
                </Button>
              }
            />
          )}

          {show("tools", live.tools) && (
            <Section
              id="tools"
              title="Tools"
              description="Every agent works with these tools. They search the web, read pages, and hand in a section. Nothing outside Mission Control changes."
              summary={
                <span className="text-sm text-muted-foreground tabular-nums">
                  {readyTools} of {TOOLS.length} ready
                </span>
              }
            >
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TOOLS.filter((tool) => !onlyLive || isLive(toolState(tool.name, status))).map((tool) => (
                  <li key={tool.name} className="flex">
                    <ToolCard tool={tool.name} status={status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {show("models", live.models) && (
            <Section
              id="models"
              title="Models"
              description="The agents run on free models through OpenRouter. When a model is busy, the agent moves to the next one."
            >
              <RowList>
                <ServiceRow item={service("openrouter")} status={status} />
              </RowList>
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-medium text-muted-foreground">Model makers in use</h3>
                <RowList>
                  {providers.map((provider) => (
                    <Row
                      key={provider.brand}
                      mark={<BrandMark brand={provider.brand} className="size-5" />}
                      name={providerName(provider.brand)}
                      blurb={provider.models.join(", ")}
                      action={
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {provider.models.length} {provider.models.length === 1 ? "model" : "models"}
                        </span>
                      }
                    />
                  ))}
                </RowList>
              </div>
            </Section>
          )}

          {show("web", live.web) && (
            <Section id="web" title="Web" description="Two services give Web search and Page reader their data.">
              <RowList>
                {webServices
                  .filter((item) => !onlyLive || isLive(item.state(status)))
                  .map((item) => (
                    <ServiceRow key={item.id} item={item} status={status} />
                  ))}
              </RowList>
            </Section>
          )}

          {appCategories.length > 0 && (
            <Section
              id="apps"
              title="Apps"
              description={
                <>
                  Connect your accounts through{" "}
                  <span className="inline-flex items-center gap-1 align-bottom text-foreground">
                    <BrandMark brand="composio" className="size-3.5" />
                    Composio
                  </span>
                  . Composio runs the sign-in and keeps the tokens, so Mission Control never stores them. Agents can&apos;t read
                  connected apps yet. That comes next.
                </>
              }
              summary={
                status.composio ? (
                  <span className="text-sm text-muted-foreground tabular-nums">{apps.connected.size} connected</span>
                ) : (
                  <SetupButton name="Composio" env={["COMPOSIO_API_KEY"]} label="Set up Composio" />
                )
              }
            >
              {appCategories.map((category) => (
                <div key={category.id} className="flex flex-col gap-1">
                  <h3 className="text-xs font-medium text-muted-foreground">{category.label}</h3>
                  <RowList>
                    {APPS.filter((app) => app.category === category.id && (!onlyLive || apps.connected.has(app.slug))).map((app) => (
                      <Row
                        key={app.slug}
                        mark={<AppMark slug={app.slug} />}
                        name={app.name}
                        blurb={app.blurb}
                        action={<AppAction slug={app.slug} name={app.name} composio={status.composio} apps={apps} />}
                      />
                    ))}
                  </RowList>
                </div>
              ))}
            </Section>
          )}

          {show("signin", live.signin) && (
            <Section id="signin" title="Sign-in" description="Ways people sign in to Mission Control. Email and password always work.">
              <RowList>
                {signInServices
                  .filter((item) => !onlyLive || isLive(item.state(status)))
                  .map((item) => (
                    <ServiceRow key={item.id} item={item} status={status} />
                  ))}
              </RowList>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV_GROUPS: { label: string; items: { id: Category; label: string }[] }[] = [
  {
    label: "Built in",
    items: [
      { id: "tools", label: "Tools" },
      { id: "models", label: "Models" },
      { id: "web", label: "Web" },
    ],
  },
  { label: "Apps", items: APP_CATEGORIES.map((category) => ({ id: category.id, label: category.label })) },
  { label: "Account", items: [{ id: "signin", label: "Sign-in" }] },
];

/** The filter column (design §6.8). A column on desktop, a row of chips below 768px. */
function FilterNav({
  filter,
  onChange,
  counts,
  connected,
}: {
  filter: Filter;
  onChange: (filter: Filter) => void;
  counts: Record<Category, number>;
  connected: number;
}) {
  const item = (id: Filter, label: string, count: number | null, icon?: Icon) => {
    const ItemIcon = icon;
    const active = filter === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(id)}
        className={cn(
          "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm whitespace-nowrap transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground md:w-full",
          active ? "bg-accent text-foreground" : "text-muted-foreground",
        )}
      >
        {ItemIcon && <ItemIcon aria-hidden className="size-4 shrink-0" />}
        <span className="flex-1">{label}</span>
        {count !== null && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      </button>
    );
  };
  return (
    <nav aria-label="Filter integrations" className="flex gap-1 md:flex-col">
      {item("all", "All", null, IconLayoutGrid)}
      {item("connected", "Connected", connected, IconCircleCheck)}
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="contents md:flex md:flex-col md:gap-1">
          <p className="hidden px-2 pt-5 pb-1 text-xs text-muted-foreground md:block">{group.label}</p>
          {group.items.map((entry) => item(entry.id, entry.label, counts[entry.id]))}
        </div>
      ))}
    </nav>
  );
}

function Section({
  id,
  title,
  description,
  summary,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id={`${id}-heading`} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        {summary && <div className="shrink-0">{summary}</div>}
      </header>
      {children}
    </section>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-x-10 sm:grid-cols-2">{children}</ul>;
}

function Row({
  mark,
  name,
  blurb,
  note,
  action,
}: {
  mark: ReactNode;
  name: string;
  blurb: string;
  note?: string;
  action: ReactNode;
}) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-raised">{mark}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-pretty text-muted-foreground">{blurb}</span>
        {note && <span className="text-xs text-pretty text-muted-foreground">{note}</span>}
      </span>
      <span className="shrink-0">{action}</span>
    </li>
  );
}

function StateBadge({ state }: { state: State }) {
  const spec = STATE_BADGE[state];
  const BadgeIcon = spec.icon;
  return (
    <Badge variant={spec.variant}>
      {BadgeIcon && <BadgeIcon aria-hidden />}
      {spec.label}
    </Badge>
  );
}

function ServiceRow({ item, status }: { item: Service; status: ServiceStatus }) {
  const state = item.state(status);
  const showNote = state !== "connected" && item.note;
  return (
    <Row
      mark={<BrandMark brand={item.brand} className="size-5" />}
      name={item.name}
      blurb={item.blurb}
      note={showNote ? item.note : undefined}
      action={
        state === "off" ? (
          <SetupButton name={item.name} env={item.env} />
        ) : (
          <StateBadge state={state} />
        )
      }
    />
  );
}

/** "Set up" for a service that an admin turns on with Convex environment values. */
function SetupButton({ name, env, label = "Set up" }: { name: string; env: string[]; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="xs" />}>{label}</PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Set up {name}</PopoverTitle>
          <PopoverDescription>
            Add {env.length === 1 ? "this key" : "these keys"} to your Convex environment. The page updates by itself.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col gap-1">
          {env.map((key) => (
            <li key={key} className="flex h-8 items-center justify-between gap-2 rounded-md bg-muted pr-1 pl-2.5">
              <span className="truncate font-mono text-xs text-foreground">
                npx convex env set {key} <span className="text-muted-foreground">…</span>
              </span>
              <CopyButton text={`npx convex env set ${key} `} label={`Copy the command for ${key}`} />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AppAction({
  slug,
  name,
  composio,
  apps,
}: {
  slug: AppSlug;
  name: string;
  composio: boolean;
  apps: ReturnType<typeof useApps>;
}) {
  if (!composio) return <SetupButton name="Composio" env={["COMPOSIO_API_KEY"]} label="Connect" />;
  if (apps.busy === slug) {
    return (
      <Button variant="outline" size="xs" disabled aria-label={`Working on ${name}`}>
        <Spinner data-icon="inline-start" />
        Wait
      </Button>
    );
  }
  if (apps.connected.has(slug)) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" size="xs" aria-label={`${name} is connected. Options`} />}>
          <IconCheck data-icon="inline-start" />
          Connected
          <IconChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => void apps.disconnect(slug)}>
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <Button variant="outline" size="xs" disabled={apps.busy !== null} onClick={() => void apps.connect(slug)}>
      Connect
    </Button>
  );
}

function ToolCard({ tool, status }: { tool: ToolName; status: ServiceStatus }) {
  const ui = TOOL_UI[tool];
  const spec = TOOLS.find((item) => item.name === tool);
  const ToolIcon = TOOL_ICON[tool];
  const poweredBy = ui.poweredBy ? service(ui.poweredBy) : null;
  const agents = agentsUsingTool(tool);
  return (
    <article className="flex w-full flex-col gap-3 rounded-xl bg-card p-4 shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-live-subtle ring-1 ring-live-border/60 ring-inset">
          <ToolIcon aria-hidden className="size-5 text-live" />
        </span>
        <StateBadge state={toolState(tool, status)} />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="flex items-baseline gap-2 text-sm font-medium text-foreground">
          {ui.title}
          <span className="font-mono text-xs font-normal text-muted-foreground">{tool}</span>
        </h3>
        <p className="text-sm text-pretty text-muted-foreground">{ui.blurb}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {agents.map((agent) => (
          <AgentChip key={agent.role} role={agent.role} />
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {poweredBy ? (
            <>
              Powered by <BrandMark brand={poweredBy.brand} className="size-3.5" />
              <span className="truncate text-foreground">{poweredBy.name}</span>
            </>
          ) : (
            "Built in"
          )}
        </span>
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" size="xs" />}>Details</DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ToolIcon aria-hidden className="size-4 text-live" />
                {ui.title}
                <span className="font-mono text-xs font-normal text-muted-foreground">{tool}</span>
              </DialogTitle>
              <DialogDescription>{ui.blurb}</DialogDescription>
            </DialogHeader>
            <dl className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs text-muted-foreground">Used by</dt>
                <dd className="flex flex-wrap gap-1">
                  {agents.map((agent) => (
                    <AgentChip key={agent.role} role={agent.role} />
                  ))}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-xs text-muted-foreground">Instructions the model gets</dt>
                <dd className="text-pretty text-foreground">{spec?.description}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="flex h-6 items-center justify-between text-xs text-muted-foreground">
                  Input schema
                  {spec && <CopyButton text={spec.inputSchema} label="Copy the input schema" />}
                </dt>
                <dd>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">{spec?.inputSchema}</pre>
                </dd>
              </div>
            </dl>
          </DialogContent>
        </Dialog>
      </div>
    </article>
  );
}
