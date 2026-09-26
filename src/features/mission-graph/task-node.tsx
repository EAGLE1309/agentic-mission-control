"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { ROLE_ICON, ROLE_LABEL } from "@/components/agent-icons";
import { StatusIcon, nodeStatusKind } from "@/components/status";
import { useRun } from "@/features/run/store";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatTokens, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NODE_HEIGHT, NODE_WIDTH } from "@/shared/layout";
import { isWorkerRole } from "@/shared/plan";
import type { MissionNode } from "@/shared/reducer";
import { flowEdgeState, type EdgeState } from "./graph-model";

// The node card (design §6.4): a gray shell with the agent, and a white body.
// It reads only its own part of the store, so a live thought updates one card.

const SHELL: Record<MissionNode["status"], string> = {
  pending: "bg-muted",
  queued: "bg-muted",
  running: "bg-live-subtle ring-1 ring-live",
  done: "bg-muted",
  failed: "bg-destructive-subtle ring-1 ring-destructive",
  killed: "bg-muted",
};

export const HANDLE_COLOR: Record<EdgeState, string> = {
  waiting: "bg-muted-foreground/40",
  active: "bg-live",
  delivered: "bg-success",
  failed: "bg-destructive",
};

function useSecondLine(node: MissionNode): { text: string; tone: "muted" | "destructive" } {
  const live = useRun((state) => state.live[node.id]);
  const titles = useRun((state) => node.dependsOn.map((id) => state.view.nodes[id]?.title).filter(Boolean).join(", "));
  const stoppedBy = useRun((state) => state.view.stoppedBy);
  const versions = useRun((state) => state.view.versions);
  switch (node.status) {
    case "pending":
      if (node.role === "report") return { text: "Waits for the tasks", tone: "muted" };
      if (node.role === "assembler") return { text: "Waits for the tasks to finish", tone: "muted" };
      return { text: titles ? `Waits for ${titles}` : "Waits to start", tone: "muted" };
    case "queued":
      return { text: "Waiting for a model slot", tone: "muted" };
    case "running":
      return { text: live || node.lastThought || "Starting…", tone: "muted" };
    case "done": {
      if (node.role === "report") {
        const latest = versions.at(-1);
        return {
          text: latest ? `v${latest.version} · ${plural(latest.words, "word")} · ${plural(latest.sourceCount, "source")}` : "Ready",
          tone: "muted",
        };
      }
      return { text: node.summary || node.lastThought || "Done", tone: "muted" };
    }
    case "failed":
      return { text: node.error || "The task failed.", tone: "destructive" };
    case "killed":
      return { text: stoppedBy === "user" ? "Stopped by you" : "Stopped", tone: "muted" };
  }
}

function Meta({ node }: { node: MissionNode }) {
  const taskCount = useRun((state) =>
    node.role === "orchestrator" ? Object.values(state.view.nodes).filter((item) => isWorkerRole(item.role)).length : 0,
  );
  const running = node.status === "running" || node.status === "queued";
  const now = useNow(1000, running);
  const elapsed = node.startedAt === null ? null : (running ? now : (node.endedAt ?? now)) - node.startedAt;

  return (
    <div className="flex h-5 items-center gap-2">
      {node.currentTool && running ? (
        <span className="inline-flex h-5 max-w-[60%] items-center truncate rounded-sm bg-muted px-1.5 font-mono text-xs text-foreground">
          {node.currentTool}
        </span>
      ) : node.role === "orchestrator" && taskCount > 0 ? (
        <span className="text-xs text-muted-foreground">{plural(taskCount, "task")}</span>
      ) : null}
      {elapsed !== null && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatClock(elapsed)}
          {node.tokens > 0 && ` · ${formatTokens(node.tokens)}`}
        </span>
      )}
    </div>
  );
}

export const TaskNode = memo(function TaskNode({ id }: NodeProps) {
  const node = useRun((state) => state.view.nodes[id]);
  return node ? <TaskCard node={node} /> : null;
});

function TaskCard({ node }: { node: MissionNode }) {
  const selected = useRun((state) => state.selectedNodeId === node.id);
  const outgoing = flowEdgeState(node);
  const line = useSecondLine(node);

  const Icon = ROLE_ICON[node.role];
  const muted = node.status === "pending" || node.status === "killed";
  const title = node.role === "report" ? "Report" : node.title;

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        "flex cursor-pointer flex-col rounded-lg p-1 shadow-raised transition-[background-color,box-shadow] duration-150 hover:shadow-raised-hover",
        "animate-node-enter motion-reduce:animate-none",
        node.isNew
          ? "border border-dashed border-live-border bg-live-subtle"
          : node.role === "report" && node.status === "done"
            ? "bg-success-subtle ring-1 ring-success/40"
            : SHELL[node.status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
      )}
    >
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} />
      <div className="flex h-6 shrink-0 items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{ROLE_LABEL[node.role]}</span>
        {node.isNew && (
          <span className="inline-flex h-4 items-center rounded-sm bg-live-subtle px-1 text-xs font-medium text-live">New</span>
        )}
        <StatusIcon status={nodeStatusKind(node.status)} className="ml-auto size-3.5" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between rounded-sm bg-card px-2 py-1.5">
        <p className={cn("truncate text-sm font-medium", muted ? "text-muted-foreground" : "text-foreground")}>{title}</p>
        <p className={cn("truncate text-xs", line.tone === "destructive" ? "text-destructive" : "text-muted-foreground")}>
          {line.text}
        </p>
        <Meta node={node} />
      </div>
      <Handle type="source" position={Position.Right} id="flow" isConnectable={false}>
        <span aria-hidden className={cn("absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full", HANDLE_COLOR[outgoing])} />
      </Handle>
      {isWorkerRole(node.role) && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="tools"
          isConnectable={false}
          style={{ left: 12 }}
        />
      )}
    </div>
  );
}
