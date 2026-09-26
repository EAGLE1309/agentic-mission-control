"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { toastTimeout } from "@/features/shell/finish-toasts";
import { errorCode } from "@/shared/errors";

/** Confirm a stop (design §5.5): it loses the work that is in progress. */
export function StopDialog({
  missionId,
  open,
  onOpenChange,
}: {
  missionId: Id<"missions">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stop = useMutation(api.missions.stop);
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await stop({ missionId });
      onOpenChange(false);
    } catch (error) {
      onOpenChange(false);
      const title =
        errorCode(error) === "MISSION_NOT_ACTIVE"
          ? "This mission already finished."
          : "The mission did not stop. Check your connection, then try again.";
      toast.add({ title, timeout: toastTimeout(title) });
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this mission?</AlertDialogTitle>
          <AlertDialogDescription>Finished tasks and their output stay.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" disabled={pending} />}>Cancel</AlertDialogCancel>
          <Button onClick={() => void confirm()} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Stop mission
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
