"use client";

import { api } from "@convex/_generated/api";
import { IconRefresh } from "@tabler/icons-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AppMark } from "@/components/app-mark";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Composer } from "@/features/composer/composer";
import { toastTimeout } from "@/features/shell/finish-toasts";
import { useMissionMeta, useMissionStatus } from "@/features/run/mission-meta";
import { useRun } from "@/features/run/store";
import { cn } from "@/lib/utils";
import { appSpec, isAppSlug, type AppSlug } from "@/shared/apps";
import { FOLLOW_UP_MAX_CHARS, MAX_FOLLOW_UPS } from "@/shared/constants";
import { appErrorData } from "@/shared/errors";
import { isMissionActive } from "@/shared/events";
import { SAVE_ID, isWorkerRole } from "@/shared/plan";

// The chat composer of a mission (FR-25, design §5.4). A message goes to the
// orchestrator, which reruns tasks, adds agents, changes the report, or saves
// it. Suggestions do the common steps in one click.

export type SendFollowUp = (message: string, rerun?: string[]) => Promise<boolean>;

/** Send a follow-up, with the error handling of the composer. Also used by the Rerun button of the trace. */
export function useSendFollowUp(onError: (message: string) => void = notify): { send: SendFollowUp; pending: boolean } {
  const meta = useMissionMeta();
  const followUp = useMutation(api.missions.followUp);
  const setVersion = useRun((state) => state.setVersion);
  const [pending, setPending] = useState(false);
  const send: SendFollowUp = async (message, rerun) => {
    setPending(true);
    try {
      await followUp({ missionId: meta._id, message, ...(rerun ? { rerun } : {}) });
      // A new version shows when it is ready.
      setVersion(null);
      return true;
    } catch (caught) {
      const data = appErrorData(caught);
      if (data?.code === "INVALID_INPUT") onError(data.message ?? "Enter what you want to do next.");
      else if (data?.code === "CAPACITY_EXHAUSTED") onError("Mission Control reached its shared model limit for today. Try again tomorrow.");
      else onError("The message did not go through. Check your connection, then try again.");
      return false;
    } finally {
      setPending(false);
    }
  };
  return { send, pending };
}

function notify(title: string) {
  toast.add({ title, timeout: toastTimeout(title) });
}

export function FollowUpComposer() {
  const meta = useMissionMeta();
  const { status } = useMissionStatus();
  const turns = useRun((state) => state.view.revisions.length);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { send, pending } = useSendFollowUp(setError);

  const used = Math.max(turns, meta.revisionCount);
  const limitReached = used >= MAX_FOLLOW_UPS;
  const active = isMissionActive(status);

  let placeholder = "Ask a question, retry tasks, or give an agent a job…";
  if (limitReached) placeholder = `This mission has ${MAX_FOLLOW_UPS} follow-ups. Start a new mission for more changes.`;
  else if (active) placeholder = "You can write when this step finishes.";

  const submit = async (message: string, rerun?: string[]) => {
    setError(null);
    if (await send(message, rerun)) setValue("");
  };

  return (
    <div className="flex flex-col gap-2">
      {!active && !limitReached && <Suggestions onPick={submit} disabled={pending} />}
      <Composer
        value={value}
        onChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
        onSubmit={(message) => submit(message)}
        placeholder={placeholder}
        labelledBy="follow-up-label"
        submitLabel="Send"
        disabled={active || limitReached}
        pending={pending}
        error={error}
        maxLength={FOLLOW_UP_MAX_CHARS}
      />
    </div>
  );
}

/**
 * One-click follow-ups from the mission state: retry the failed tasks, and save
 * the report to an app that allows it. They appear only when they apply.
 */
function Suggestions({ onPick, disabled }: { onPick: (message: string, rerun?: string[]) => void; disabled: boolean }) {
  // A joined string keeps the selector stable between renders.
  const failedKey = useRun((state) =>
    state.view.nodeOrder
      .filter((id) => {
        const node = state.view.nodes[id];
        return id !== SAVE_ID && isWorkerRole(node.role) && (node.status === "failed" || node.status === "killed");
      })
      .join(","),
  );
  const hasReport = useRun((state) => state.view.versions.length > 0);
  const savedTo = useRun((state) => (state.view.nodes[SAVE_ID]?.status === "done" ? state.view.nodes[SAVE_ID].title : ""));
  const connections = useQuery(api.apps.connections);

  const failed = failedKey ? failedKey.split(",") : [];
  const saveApps = (connections ?? [])
    .filter((row) => row.write && isAppSlug(row.toolkit) && appSpec(row.toolkit).write && !appSpec(row.toolkit).write?.needsTarget)
    .map((row) => row.toolkit as AppSlug)
    .filter((slug) => !savedTo.endsWith(appSpec(slug).name))
    .slice(0, 2);

  const items: { key: string; label: string; icon: React.ReactNode; run: () => void }[] = [];
  if (failed.length > 0) {
    items.push({
      key: "retry",
      label: failed.length === 1 ? "Retry the failed task" : `Retry ${failed.length} failed tasks`,
      icon: <IconRefresh aria-hidden />,
      run: () => onPick(failed.length === 1 ? "Retry the failed task." : "Retry the failed tasks.", failed),
    });
  }
  if (hasReport) {
    for (const slug of saveApps) {
      const name = appSpec(slug).name;
      items.push({
        key: `save-${slug}`,
        label: `Save the report to ${name}`,
        icon: <AppMark slug={slug} className="size-3.5" />,
        run: () => onPick(`Save the report to ${name}.`),
      });
    }
  }
  if (items.length === 0) return null;

  return (
    <ul aria-label="Suggestions" className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <li
          key={item.key}
          style={{ animationDelay: `${index * 40}ms` }}
          className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-200 ease-out motion-reduce:animate-none"
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={item.run}
            className={cn("rounded-full transition-[background-color,scale] duration-150 ease-out active:scale-[0.97]")}
          >
            {item.icon}
            {item.label}
          </Button>
        </li>
      ))}
    </ul>
  );
}
