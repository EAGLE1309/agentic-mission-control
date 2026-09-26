"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

/** Toast duration (design §5.7): 4s minimum, plus 1s for each 4 words. */
export function toastTimeout(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return 4_000 + Math.ceil(words / 4) * 1_000;
}

/**
 * A mission that finishes outside the current view shows a toast with "Open"
 * (design §5.7). Items that exist at load time do not toast, so a reload
 * never repeats a toast.
 */
export function FinishToasts() {
  const latest = useQuery(api.inbox.latest);
  const pathname = usePathname();
  const router = useRouter();
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (latest === undefined) return;
    const id = latest?._id ?? null;
    if (seen.current === undefined) {
      seen.current = id;
      return;
    }
    if (id === null || id === seen.current) return;
    seen.current = id;
    if (latest === null || latest.readAt !== null || pathname === `/missions/${latest.missionId}`) return;

    const verb = latest.kind === "mission_failed" ? "failed" : latest.partial ? "completed with missing parts" : "completed";
    const title = `“${latest.title}” ${verb}`;
    toast.add({
      title,
      timeout: toastTimeout(title),
      actionProps: { children: "Open", onClick: () => router.push(`/missions/${latest.missionId}`) },
    });
  }, [latest, pathname, router]);

  return null;
}
