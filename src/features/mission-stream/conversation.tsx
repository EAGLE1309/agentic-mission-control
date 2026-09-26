"use client";

import { IconCircleX } from "@tabler/icons-react";
import { memo } from "react";
import { ROLE_ICON } from "@/components/agent-icons";
import { StatusIcon, nodeStatusKind } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRun } from "@/features/run/store";
import { useNow } from "@/hooks/use-now";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isTerminalNodeStatus, ASSEMBLER_ID, SAVE_ID } from "@/shared/plan";
import type { MissionNode, RevisionItem } from "@/shared/reducer";
import { RichText } from "./rich-text";

// The chat of a mission (FR-25, design §6.3): each follow-up turn shows the
// message, the reply of the orchestrator, the tasks that the turn runs, and
// what came out. New parts fade in; nothing moves that is already on screen.

const ENTER = "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none";

export function Conversation() {
  const turns = useRun((state) => state.view.revisions);
  if (turns.length === 0) return null;
  return (
    <section aria-label="Follow-ups" className="flex flex-col gap-5">
      {turns.map((turn) => (
        <Turn key={turn.nodeId} turn={turn} />
      ))}
    </section>
  );
}

const OrchestratorIcon = ROLE_ICON.orchestrator;

const Turn = memo(function Turn({ turn }: { turn: RevisionItem }) {
  const node = useRun((state) => state.view.nodes[turn.nodeId]);
  const reply = node?.steps.find((step) => step.text.trim())?.text ?? null;
  const status = node?.status ?? "pending";

  return (
    <article className={cn("flex flex-col gap-2.5", ENTER, "slide-in-from-bottom-1")}>
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
        {turn.instruction}
      </p>
      <div className="flex gap-2.5">
        <span aria-hidden className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-card shadow-raised">
          <OrchestratorIcon className="size-3.5 text-muted-foreground" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {reply ? (
            <RichText text={reply} className={cn("text-sm text-foreground", ENTER)} />
          ) : status === "failed" || status === "killed" ? null : (
            <p className="flex h-6 items-center gap-1.5 text-sm text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Reading the mission…
            </p>
          )}
          {turn.taskIds.length > 0 && (
            <ul aria-label="Tasks of this follow-up" className="flex flex-wrap gap-1.5">
              {turn.taskIds.map((id, index) => (
                <TaskPill key={id} nodeId={id} index={index} />
              ))}
            </ul>
          )}
          {node && <TurnFooter turn={turn} node={node} />}
        </div>
      </div>
    </article>
  );
});

/** One task of the turn. Its icon swaps with a short scale when the status changes. */
const TaskPill = memo(function TaskPill({ nodeId, index }: { nodeId: string; index: number }) {
  const node = useRun((state) => state.view.nodes[nodeId]);
  const openTrace = useRun((state) => state.openTrace);
  if (!node) return null;
  const running = node.status === "running" || node.status === "queued";
  const failed = node.status === "failed";
  return (
    <li style={{ animationDelay: `${index * 40}ms` }} className={cn(ENTER, "zoom-in-95 fill-mode-both")}>
      <button
        type="button"
        onClick={() => openTrace(nodeId)}
        title={node.title}
        className={cn(
          "flex h-7 max-w-60 items-center gap-1.5 rounded-full px-2.5 text-xs transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97]",
          running ? "bg-live-subtle text-live" : failed ? "bg-destructive-subtle text-destructive" : "bg-muted text-foreground hover:bg-accent",
        )}
      >
        <StatusIcon
          key={node.status}
          status={nodeStatusKind(node.status)}
          className="size-3.5 animate-in fade-in-0 zoom-in-75 duration-150 ease-out motion-reduce:animate-none"
        />
        <span className="truncate">{node.title}</span>
      </button>
    </li>
  );
});

/** What the turn does now, then what came out of it. */
function TurnFooter({ turn, node }: { turn: RevisionItem; node: MissionNode }) {
  const open = !isTerminalNodeStatus(node.status);
  const progress = useRun((state) => {
    if (!open) return null;
    const tasks = turn.taskIds.filter((id) => id !== SAVE_ID).map((id) => state.view.nodes[id]).filter(Boolean);
    const busy = tasks.filter((task) => task.status === "running" || task.status === "queued").length;
    if (busy > 0) return `Running ${busy} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    if (state.view.nodes[ASSEMBLER_ID]?.status === "running") return "Writing the report";
    const save = state.view.nodes[SAVE_ID];
    if (turn.taskIds.includes(SAVE_ID) && save?.status === "running") return save.title.replace(/^Save/, "Saving");
    return node.steps.some((step) => step.text.trim()) ? "Working" : null;
  });
  const setVersion = useRun((state) => state.setVersion);
  const setTab = useRun((state) => state.setTab);
  const setMobilePane = useRun((state) => state.setMobilePane);
  const now = useNow(1000, open);

  if (open) {
    if (!progress) return null;
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums", ENTER)}>
        <Spinner aria-hidden className="size-3 text-live" />
        {progress} · {formatDuration(Math.max(0, now - turn.at))}
      </p>
    );
  }
  if (node.status === "failed") {
    return (
      <p className="flex items-start gap-1.5 rounded-md bg-destructive-subtle px-2.5 py-2 text-xs text-destructive">
        <IconCircleX aria-hidden className="mt-px size-3.5 shrink-0" />
        {node.error ?? "The follow-up failed."}
      </p>
    );
  }
  if (node.status === "killed") return <p className="text-xs text-muted-foreground">Stopped</p>;
  return (
    <div className={cn("flex min-h-7 items-center gap-2 text-xs text-muted-foreground", ENTER)}>
      <StatusIcon status={nodeStatusKind(node.status)} className="size-3.5" />
      <span className="min-w-0 truncate">{node.summary ?? "Done"}</span>
      {turn.version !== null && (
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          onClick={() => {
            setVersion(turn.version);
            setTab("report");
            setMobilePane("report");
          }}
        >
          Open v{turn.version}
        </Button>
      )}
    </div>
  );
}
