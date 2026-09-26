import { IconArrowUp, IconFileText, IconSitemap, IconTelescope } from "@tabler/icons-react";
import { AgentChip } from "@/components/agent-chip";
import { TOOL_ICON } from "@/components/agent-icons";
import { AppMark } from "@/components/app-mark";
import { FaviconStack } from "@/components/favicon";
import { ProviderMark } from "@/components/provider-mark";
import { StatusBadge, StatusIcon, type StatusKind } from "@/components/status";
import type { ToolName } from "@/shared/events";
import { cn } from "@/lib/utils";

// Illustrations of the run view for the landing (design §6.12). They reuse the
// app's chips, marks, and status icons, so they match the product. They are
// pictures: one accessible name, no pointer events, no text selection.

function Illustration({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("pointer-events-none select-none", className)}>
      {children}
    </div>
  );
}

type NodeSketch = { title: string; line: string; status: StatusKind };

function NodeCard({ node, selected }: { node: NodeSketch; selected?: boolean }) {
  const running = node.status === "running";
  return (
    <div
      className={cn(
        "flex w-56 flex-col rounded-lg p-1 shadow-raised",
        running ? "bg-live-subtle ring-1 ring-live" : "bg-muted",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
      )}
    >
      <div className="flex h-6 items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
        <IconTelescope aria-hidden className="size-3.5" />
        Researcher
        <StatusIcon status={node.status} className="ml-auto size-3.5" />
      </div>
      <div className="flex flex-col gap-0.5 rounded-sm bg-card px-2 py-1.5">
        <p className="truncate text-sm font-medium text-foreground">{node.title}</p>
        <p className="truncate text-xs text-muted-foreground">{node.line}</p>
      </div>
    </div>
  );
}

type ToolSketch = { tool: ToolName; input: string; ms?: number; status: StatusKind; sites?: string[]; results?: number };

function ToolRow({ call }: { call: ToolSketch }) {
  const Icon = TOOL_ICON[call.tool];
  const running = call.status === "running";
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg px-2.5 py-2 text-xs",
        running ? "bg-live-subtle ring-1 ring-live-border ring-inset" : "bg-muted/70",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className={cn("size-3.5 shrink-0", running ? "text-live" : "text-muted-foreground")} />
        <span className="shrink-0 font-mono text-foreground">{call.tool}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{call.input}</span>
        {call.ms !== undefined && <span className="shrink-0 text-muted-foreground tabular-nums">{call.ms} ms</span>}
        <StatusIcon status={call.status} className="size-3.5" />
      </div>
      {call.sites && (
        <div className="flex items-center gap-2 pl-5.5 text-muted-foreground">
          <FaviconStack sites={call.sites} />
          <span>{call.results} results</span>
        </div>
      )}
    </div>
  );
}

const TRACE_CALLS: ToolSketch[] = [
  {
    tool: "web_search",
    input: "open-source vector database for RAG",
    ms: 442,
    status: "ok",
    sites: ["qdrant.tech", "weaviate.io", "trychroma.com", "milvus.io"],
    results: 8,
  },
  { tool: "fetch_url", input: "qdrant.tech/documentation", ms: 898, status: "ok" },
  { tool: "fetch_url", input: "docs.trychroma.com/docs/overview", status: "running" },
];

/** A task on the graph, selected, and its trace: the thoughts and tool calls in order. */
export function TraceIllustration() {
  return (
    <Illustration
      label="A selected research task on the graph, next to its trace: a thought, a web search with 8 results, one page read, and one page read in progress."
      className="relative overflow-hidden rounded-2xl bg-canvas p-4 shadow-raised sm:p-8"
    >
      <div className="flex items-center gap-8">
        <div className="hidden shrink-0 flex-col gap-5 lg:flex">
          <NodeCard node={{ title: "Main options and players", line: "Reading docs.trychroma.com", status: "running" }} selected />
          <NodeCard node={{ title: "Costs and tradeoffs", line: "3 sources", status: "done" }} />
        </div>

        <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl bg-popover shadow-overlay">
          <div className="flex flex-col gap-1.5 border-b p-3">
            <div className="flex items-center gap-2">
              <IconTelescope aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <p className="truncate text-base font-semibold text-foreground">Main options and players</p>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusBadge status="running" />
              <AgentChip role="researcher" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ProviderMark modelId="nvidia/nemotron" className="size-3.5" />
              <span className="text-foreground">Nemotron 3.5 Lightning</span>
              NVIDIA
            </p>
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <p className="text-xs text-muted-foreground">Step 1 · 0:02</p>
            <p className="text-sm text-pretty text-foreground">
              Find the main open-source vector databases. Then read one guide for each, and note what makes it different.
            </p>
            <div className="flex flex-col gap-1.5">
              {TRACE_CALLS.map((call) => (
                <ToolRow key={call.input} call={call} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground tabular-nums">
            <span>3 tool calls</span>
            <span>9.4s · 3.1k tokens</span>
          </div>
        </div>
      </div>
    </Illustration>
  );
}

/** A follow-up in the chat: the ask, the director's reply, and the new tasks it starts. */
export function FollowUpIllustration({ className }: { className?: string }) {
  return (
    <Illustration
      label="The chat after a report: the user asks for a part on hosting costs and a save to Notion. The orchestrator adds a research task, a new report version, and a save to Notion."
      className={cn("flex flex-col gap-4 rounded-2xl bg-sidebar p-3 shadow-raised sm:p-4", className)}
    >
      <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-raised">
        <IconFileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">Report v1 is ready</span>
        <span className="text-xs text-muted-foreground tabular-nums">584 words · 16 sources</span>
      </div>

      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm text-foreground">
        Add a part on hosting costs. Then save the report to Notion.
      </p>

      <div className="flex gap-2.5">
        <span aria-hidden className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-card shadow-raised">
          <IconSitemap className="size-3.5 text-muted-foreground" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="text-sm text-foreground">
            I will add one research task, write report v2, and save it to Notion.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            <li className="flex h-7 items-center gap-1.5 rounded-full bg-live-subtle px-2.5 text-xs text-live">
              <StatusIcon status="running" className="size-3.5" />
              Hosting costs
            </li>
            <li className="flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-foreground">
              <StatusIcon status="pending" className="size-3.5" />
              Report v2
            </li>
            <li className="flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-foreground">
              <AppMark slug="notion" className="size-3.5" />
              Save to Notion
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-2 flex h-11 items-center gap-2 rounded-xl bg-card pr-1.5 pl-3.5 shadow-raised">
        <span className="flex-1 text-sm text-muted-foreground">Ask for a change…</span>
        <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IconArrowUp className="size-4" />
        </span>
      </div>
    </Illustration>
  );
}
