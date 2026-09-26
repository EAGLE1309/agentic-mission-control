"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { toastTimeout } from "@/features/shell/finish-toasts";
import { Composer } from "@/features/composer/composer";
import { useMissionMeta, useMissionStatus } from "@/features/run/mission-meta";
import { useRun } from "@/features/run/store";
import { MAX_REVISIONS, REVISION_MAX_CHARS } from "@/shared/constants";
import { appErrorData } from "@/shared/errors";

/** Follow-up composer (FR-25, design §5.4 placeholders). */
export function RevisionComposer() {
  const meta = useMissionMeta();
  const { status } = useMissionStatus();
  const hasReport = useRun((state) => state.view.versions.length > 0);
  const revisions = useRun((state) => state.view.revisions.length);
  const setVersion = useRun((state) => state.setVersion);
  const revise = useMutation(api.missions.revise);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const used = Math.max(revisions, meta.revisionCount);
  const limitReached = used >= MAX_REVISIONS;
  const ready = status === "completed" && hasReport;

  let placeholder = "Ask for changes to the report…";
  if (limitReached) placeholder = `This mission has ${MAX_REVISIONS} revisions. Start a new mission for more changes.`;
  else if (!ready) placeholder = "You can ask for changes when the report is ready.";

  const submit = async (instruction: string) => {
    setPending(true);
    setError(null);
    try {
      await revise({ missionId: meta._id, instruction });
      setValue("");
      // The new version shows when it is ready.
      setVersion(null);
    } catch (caught) {
      const data = appErrorData(caught);
      if (data?.code === "INVALID_INPUT") setError(data.message ?? "Enter the change you want.");
      else if (data?.code === "MISSION_NOT_ACTIVE") {
        const title = "This mission already finished. Ask for changes to the report instead.";
        toast.add({ title, timeout: toastTimeout(title) });
      }
      else setError("The request did not go through. Check your connection, then try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Composer
      value={value}
      onChange={(next) => {
        setValue(next);
        if (error) setError(null);
      }}
      onSubmit={submit}
      placeholder={placeholder}
      labelledBy="revision-label"
      submitLabel="Send changes"
      disabled={!ready || limitReached}
      pending={pending}
      error={error}
      maxLength={REVISION_MAX_CHARS}
    />
  );
}
