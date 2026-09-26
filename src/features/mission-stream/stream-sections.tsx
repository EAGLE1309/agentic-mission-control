"use client";

import { IconCircleX, IconFileText } from "@tabler/icons-react";
import { memo } from "react";
import { AgentChip } from "@/components/agent-chip";
import { ROLE_LABEL, TOOL_ICON, toolCallStatusKind } from "@/components/agent-icons";
import { AppMark } from "@/components/app-mark";
import { Favicon, FaviconStack } from "@/components/favicon";
import { appSpec, type AppSlug } from "@/shared/apps";
import { StatusIcon, missionStatusKind, nodeStatusKind, statusSpec } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMissionMeta, useMissionStatus } from "@/features/run/mission-meta";
import { useRun } from "@/features/run/store";
import { useNow } from "@/hooks/use-now";
import { formatDuration, formatLatency, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isMissionActive } from "@/shared/events";
import { SAVE_ID, isWorkerRole } from "@/shared/plan";
import { toolCallApp, toolInputSummary } from "./tool-summary";

// The stream items (FR-21, design §6.3), top to bottom.

function SectionLabel({ children }: { children: string }) {
  return <h3 className="text-xs text-muted-foreground">{children}</h3>;
}

/** 1. Orchestrator narration. New chunks fade in, with no typewriter effect. */
export function Narration() {
  const narration = useRun((state) => state.view.narration);
  if (narration.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {narration.map((item) => (
        <p
          key={item.seq}
          className="text-sm text-pretty text-muted-foreground animate-in fade-in-0 duration-200 ease-out motion-reduce:duration-150"
        >
          {item.text}
        </p>
      ))}
    </div>
  );
}

/** 2. Status line: "Working · 1m 01s · 2.5k tokens", then the final state. */
export function StatusLine() {
  const meta = useMissionMeta();
  const { status, partial } = useMissionStatus();
  const tokens = useRun((state) => state.view.stats.tokens) || meta.stats.tokens;
  const createdAt = useRun((state) => state.view.createdAt) ?? meta.createdAt;
  const durationMs = useRun((state) => state.view.durationMs) ?? meta.durationMs;
  const error = useRun((state) => state.view.error);
  const active = isMissionActive(status);
  const now = useNow(1000, active);
  const elapsed = active ? now - createdAt : (durationMs ?? 0);
  const tokenText = `${formatTokens(tokens)} tokens`;

  let text: string;
  if (active) text = `${status === "queued" ? "Starting" : "Working"} · ${formatDuration(elapsed)} · ${tokenText}`;
  else if (status === "completed") text = `Completed${partial ? " with missing parts" : ""} in ${formatDuration(elapsed)} · ${tokenText}`;
  else if (status === "failed") text = `Failed after ${formatDuration(elapsed)} · ${tokenText}`;
  else text = `Stopped after ${formatDuration(elapsed)} · ${tokenText}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        {active ? <Spinner className="size-3.5 text-live" aria-hidden /> : <StatusIcon status={missionStatusKind(status, partial)} className="size-3.5" />}
        {text}
      </p>
      {status === "failed" && error && (
        <p className="flex items-start gap-2 rounded-md bg-destructive-subtle p-3 text-sm text-destructive">
          <IconCircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** 3. Plan: one row for each task. It is also the accessible form of the graph. */
export function PlanList() {
  const nodeOrder = useRun((state) => state.view.nodeOrder);
  const nodes = useRun((state) => state.view.nodes);
  const tasks = nodeOrder.filter((id) => isWorkerRole(nodes[id].role) || nodes[id].role === "revision");
  if (tasks.length === 0) return null;
  return (
    <section className="flex flex-col gap-1" aria-label="Plan">
      <SectionLabel>Plan</SectionLabel>
      <ol className="flex flex-col">
        {tasks.map((id) => (
          <PlanRow key={id} nodeId={id} />
        ))}
      </ol>
    </section>
  );
}

const PlanRow = memo(function PlanRow({ nodeId }: { nodeId: string }) {
  const node = useRun((state) => state.view.nodes[nodeId]);
  const selected = useRun((state) => state.selectedNodeId === nodeId);
  const openTrace = useRun((state) => state.openTrace);
  const kind = nodeStatusKind(node.status);
  const label = statusSpec(kind).label;
  return (
    <li>
      <button
        type="button"
        onClick={() => openTrace(nodeId)}
        aria-current={selected ? "true" : undefined}
        aria-label={`${ROLE_LABEL[node.role]} task: ${node.title}, ${label}. Open trace.`}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-[background-color] duration-150 hover:bg-accent",
          selected && "bg-accent",
        )}
      >
        <StatusIcon status={kind} className="size-3.5" />
        <span className="min-w-0 truncate text-foreground" title={node.title}>
          {node.title}
        </span>
        <AgentChip role={node.role} />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{label}</span>
      </button>
    </li>
  );
});

/** 4. Activity: one row for each tool call. New rows go at the bottom. */
export function ActivityList() {
  const activity = useRun((state) => state.view.activity);
  if (activity.length === 0) return null;
  return (
    <section className="flex flex-col gap-1" aria-label="Activity">
      <SectionLabel>Activity</SectionLabel>
      <ul className="flex flex-col">
        {activity.map((callId) => (
          <ActivityRow key={callId} callId={callId} />
        ))}
      </ul>
    </section>
  );
}

const ActivityRow = memo(function ActivityRow({ callId }: { callId: string }) {
  const call = useRun((state) => state.view.toolCalls[callId]);
  const openTrace = useRun((state) => state.openTrace);
  const ToolIcon = TOOL_ICON[call.tool];
  const summary = toolInputSummary(call.tool, call.inputPreview);
  return (
    <li className="animate-in fade-in-0 duration-200 ease-out motion-reduce:duration-150">
      <button
        type="button"
        onClick={() => openTrace(call.nodeId)}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-[background-color] duration-150 hover:bg-accent"
        title={summary}
      >
        <StatusIcon status={toolCallStatusKind(call.status)} className="size-3.5" />
        <ToolIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-mono text-xs text-foreground">{call.tool}</span>
        {call.tool === "fetch_url" && call.urls[0] && <Favicon site={call.urls[0]} />}
        {toolCallApp(call.tool, call.inputPreview) && (
          <AppMark slug={toolCallApp(call.tool, call.inputPreview) as AppSlug} className="size-3.5" />
        )}
        <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
        {(call.tool === "web_search" || call.tool === "app_search") && <FaviconStack sites={call.urls} className="ml-auto" />}
        <span className={cn("shrink-0 text-xs text-muted-foreground tabular-nums", (call.tool !== "web_search" && call.tool !== "app_search") || call.urls.length === 0 ? "ml-auto" : "")}>
          {call.durationMs !== null ? formatLatency(call.durationMs) : ""}
        </span>
      </button>
    </li>
  );
});

/** 5. Report card. It opens the Report tab, and the saved copy when the plan saved the report to an app. */
export function ReportCard() {
  const latest = useRun((state) => state.view.versions.at(-1));
  const savedUrl = useRun((state) => {
    const node = state.view.nodes[SAVE_ID];
    return node?.status === "done" ? (node.sources[0]?.url ?? null) : null;
  });
  const savedApp = useRun((state) => {
    const call = Object.values(state.view.toolCalls).find((item) => item.nodeId === SAVE_ID);
    return call ? toolCallApp(call.tool, call.inputPreview) : null;
  });
  const setTab = useRun((state) => state.setTab);
  const setMobilePane = useRun((state) => state.setMobilePane);
  const setVersion = useRun((state) => state.setVersion);
  if (!latest) return null;
  const savedName = savedApp ? appSpec(savedApp).name : "app";
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-raised animate-in fade-in-0 duration-200 ease-out">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-live-subtle ring-1 ring-live-border/60 ring-inset">
        <IconFileText aria-hidden className="size-4 text-live" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">Report v{latest.version} is ready</span>
      {savedUrl && (
        <Button
          variant="ghost"
          size="sm"
          title={`The copy of the report in ${savedName}`}
          render={<a href={savedUrl} target="_blank" rel="noreferrer" />}
        >
          {savedApp && <AppMark slug={savedApp} className="size-3.5" />}
          Open in {savedName}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setVersion(null);
          setTab("report");
          setMobilePane("report");
        }}
      >
        Open report
      </Button>
    </div>
  );
}

