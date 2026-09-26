"use client";

import { IconChevronRight, IconCircleX, IconClock, IconRefresh, IconX } from "@tabler/icons-react";
import { memo, useEffect, useRef, type ReactNode } from "react";
import { AgentChip } from "@/components/agent-chip";
import { AppMark } from "@/components/app-mark";
import { Favicon, FaviconStack } from "@/components/favicon";
import type { AppSlug } from "@/shared/apps";
import { ROLE_ICON, TOOL_ICON, toolCallStatusKind } from "@/components/agent-icons";
import { ProviderMark, modelName, providerName } from "@/components/provider-mark";
import { EmptyState } from "@/components/empty-state";
import { IconButton } from "@/components/icon-button";
import { StatusBadge, StatusIcon, nodeStatusKind } from "@/components/status";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { useSendFollowUp } from "@/features/mission-stream/follow-up-composer";
import { toolCallApp, toolInputSummary } from "@/features/mission-stream/tool-summary";
import { useMissionStatus } from "@/features/run/mission-meta";
import { useRun } from "@/features/run/store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isMissionActive } from "@/shared/events";
import { SAVE_ID, isWorkerRole } from "@/shared/plan";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatDuration, formatLatency, formatTokens, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MissionNode, TraceStep } from "@/shared/reducer";
import { sourceHost } from "@/shared/report";
import { TextBlock } from "./artifact-block";

// The trace of one task (FR-22, design §6.5): instructions, the reasoning of
// each step, each tool call with input and output, times, tokens, and errors.

export function TraceContent({ nodeId, onClose, focusTitle }: { nodeId: string; onClose: () => void; focusTitle: boolean }) {
  const node = useRun((state) => state.view.nodes[nodeId]);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // When the panel opens, focus goes to its title (design §6.5).
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle, nodeId]);

  if (!node) return null;
  const Icon = ROLE_ICON[node.role];
  const title = node.role === "report" ? "Report" : node.title;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-col gap-1.5 border-b p-3">
        <div className="flex items-center gap-2">
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <h2 ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-base font-semibold outline-none" title={title}>
            {title}
          </h2>
          <IconButton label="Close trace" shortcut="Esc" onClick={onClose}>
            <IconX />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <StatusBadge status={nodeStatusKind(node.status)} />
          <AgentChip role={node.role} />
          {node.attempt > 0 && <span>· attempt {node.attempt}</span>}
          <RerunButton node={node} />
        </div>
        {node.model && (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={node.model}>
            <ProviderMark modelId={node.model} className="size-3.5" />
            <span className="truncate text-foreground">{modelName(node.model)}</span>
            <span className="shrink-0">{providerName(node.model)}</span>
          </p>
        )}
      </header>

      <MessageScrollerProvider autoScroll defaultScrollPosition="start">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Trace steps" className="px-3">
            <MessageScrollerContent className="gap-4 py-3">
              {node.instructions && node.role !== "report" && (
                <MessageScrollerItem messageId="instructions">
                  <Instructions text={node.instructions} />
                </MessageScrollerItem>
              )}
              {node.steps.length === 0 && node.failures.length === 0 ? (
                <MessageScrollerItem messageId="empty">
                  <EmptyState icon={IconClock} title="No steps yet" description="Steps show here when the task starts." className="p-4" />
                </MessageScrollerItem>
              ) : (
                <TraceTimeline node={node} />
              )}
              {node.status === "done" && (node.summary || node.outputArtifactId) && node.role !== "report" && (
                <MessageScrollerItem messageId="output">
                  <OutputSection node={node} />
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>

      <TraceFooter node={node} />
    </div>
  );
}

/**
 * Run one task again (FR-25), with the tasks that depend on it, then a new
 * report version. Only after the mission or the last follow-up ended.
 */
function RerunButton({ node }: { node: MissionNode }) {
  const { status } = useMissionStatus();
  const { send, pending } = useSendFollowUp();
  if (!isWorkerRole(node.role) || node.id === SAVE_ID || isMissionActive(status)) return null;
  const retry = node.status === "failed" || node.status === "killed";
  const label = retry ? "Retry" : "Rerun";
  return (
    <Button
      variant={retry ? "default" : "outline"}
      size="xs"
      disabled={pending}
      onClick={() => void send(`${label} “${node.title}”.`, [node.id])}
      className="ml-auto transition-[background-color,scale] duration-150 ease-out active:scale-[0.97]"
    >
      {pending ? <Spinner aria-hidden data-icon="inline-start" /> : <IconRefresh aria-hidden data-icon="inline-start" />}
      {label}
    </Button>
  );
}

function Instructions({ text }: { text: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex h-7 items-center gap-1.5 rounded-md text-sm text-foreground">
        <IconChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-90 motion-reduce:transition-none" />
        Instructions
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Steps and failures in time order. A retry starts a new attempt group. */
function TraceTimeline({ node }: { node: MissionNode }) {
  const items: { at: number; key: string; render: () => ReactNode }[] = [
    ...node.steps.map((step, index) => ({
      at: step.at,
      key: `step-${step.attempt}-${step.step}-${index}`,
      render: () => <StepItem node={node} step={step} />,
    })),
    ...node.failures.map((failure, index) => ({
      at: failure.at,
      key: `failure-${index}`,
      render: () => (
        <p className="flex items-start gap-2 rounded-md bg-destructive-subtle p-3 text-sm text-destructive">
          <IconCircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">
            {failure.error}
            {node.attempt > 1 && <span className="block text-xs">Attempt {failure.attempt}</span>}
          </span>
        </p>
      ),
    })),
  ].sort((a, b) => a.at - b.at);

  return (
    <>
      {items.map((item) => (
        <MessageScrollerItem key={item.key} messageId={item.key}>
          {item.render()}
        </MessageScrollerItem>
      ))}
    </>
  );
}

const StepItem = memo(function StepItem({ node, step }: { node: MissionNode; step: TraceStep }) {
  const offset = node.startedAt === null ? 0 : step.at - node.startedAt;
  return (
    <section className="flex flex-col gap-1.5" aria-label={`Step ${step.step}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">Step {step.step}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatClock(Math.max(0, offset))}
          {step.tokens > 0 && ` · ${formatTokens(step.tokens)}`}
        </span>
      </div>
      {step.text && <p className="text-sm whitespace-pre-wrap text-foreground">{step.text}</p>}
      {step.callIds.length > 0 && (
        <ul className="flex flex-col gap-1">
          {step.callIds.map((callId) => (
            <ToolCallRow key={callId} callId={callId} />
          ))}
        </ul>
      )}
    </section>
  );
});

const ToolCallRow = memo(function ToolCallRow({ callId }: { callId: string }) {
  const call = useRun((state) => state.view.toolCalls[callId]);
  if (!call) return null;
  const ToolIcon = TOOL_ICON[call.tool];
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger className="group flex h-7 w-full items-center gap-2 rounded-md px-1 text-left transition-[background-color] duration-150 hover:bg-accent">
          <IconChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-panel-open:rotate-90 motion-reduce:transition-none" />
          <StatusIcon status={toolCallStatusKind(call.status)} className="size-3.5" />
          <ToolIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-mono text-xs text-foreground">{call.tool}</span>
          {call.tool === "fetch_url" && call.urls[0] && <Favicon site={call.urls[0]} />}
        {toolCallApp(call.tool, call.inputPreview) && (
          <AppMark slug={toolCallApp(call.tool, call.inputPreview) as AppSlug} className="size-3.5" />
        )}
          <span className="min-w-0 truncate text-xs text-muted-foreground">{toolInputSummary(call.tool, call.inputPreview)}</span>
          {(call.tool === "web_search" || call.tool === "app_search") && <FaviconStack sites={call.urls} className="ml-auto" />}
          <span className={cn("shrink-0 text-xs text-muted-foreground tabular-nums", (call.tool !== "web_search" && call.tool !== "app_search") || call.urls.length === 0 ? "ml-auto" : "")}>
            {call.durationMs !== null ? formatLatency(call.durationMs) : ""}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1 flex flex-col gap-2 pl-6">
            <TextBlock label="Input" preview={call.inputPreview} artifactId={call.inputArtifactId} />
            {call.status === "running" ? (
              <p className="text-xs text-muted-foreground">Waiting for the result…</p>
            ) : call.status === "cancelled" ? (
              <p className="text-xs text-muted-foreground">The task ended before the tool finished.</p>
            ) : (
              <TextBlock
                label={call.status === "error" ? "Error" : "Output"}
                preview={call.status === "error" ? (call.error ?? call.outputPreview ?? "") : (call.outputPreview ?? "")}
                artifactId={call.outputArtifactId}
                tone={call.status === "error" ? "destructive" : "default"}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
});

function OutputSection({ node }: { node: MissionNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Output">
      <TextBlock label="Output" preview={node.summary ?? ""} artifactId={node.outputArtifactId} />
      {node.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Sources</span>
          <ol className="flex flex-col gap-1">
            {node.sources.map((item) => (
              <li key={item.url} className="flex min-w-0 flex-col">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="truncate text-sm text-link underline-offset-2 hover:underline"
                  title={item.title}
                >
                  {item.title}
                </a>
                <span className="truncate font-mono text-xs text-muted-foreground">{sourceHost(item.url)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}


function TraceFooter({ node }: { node: MissionNode }) {
  const running = node.status === "running" || node.status === "queued";
  const now = useNow(1000, running);
  const elapsed = node.startedAt === null ? 0 : (running ? now : (node.endedAt ?? now)) - node.startedAt;
  return (
    <footer className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground tabular-nums">
      {plural(node.steps.length, "step")} · {plural(node.toolCallCount, "tool call")} · {formatDuration(elapsed)} ·{" "}
      {formatTokens(node.tokens)} tokens
    </footer>
  );
}

