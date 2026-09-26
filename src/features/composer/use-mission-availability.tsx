"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useShellData } from "@/features/shell/use-shell-data";
import { formatTimeOfDay } from "@/lib/format";
import type { AppErrorData } from "@/shared/errors";
import type { BannerTone } from "./composer";

export type Availability = { banner: ReactNode; tone: BannerTone; blocked: boolean };

/**
 * The composer banner (FR-9, design §5.4 and §5.7): missions left today, or a
 * warning when the quota or the shared capacity is empty. A refused create
 * (serverError) shows at once, before the live data updates.
 */
export function useMissionAvailability(serverError: AppErrorData | null): Availability {
  const { quota, unlimited, capacity } = useShellData();

  const capacityReached = capacity?.level === "reached" || serverError?.code === "CAPACITY_EXHAUSTED";
  if (capacityReached) {
    const resetAt = serverError?.resetAt ?? capacity?.resetAt;
    return {
      tone: "warning",
      blocked: true,
      banner: (
        <>
          <IconAlertTriangle aria-hidden className="size-3.5 shrink-0 text-warning" />
          <span>
            Mission Control reached its shared limit for today.
            {resetAt ? ` New missions open at ${formatTimeOfDay(resetAt)}.` : ""} Running missions continue.
          </span>
        </>
      ),
    };
  }

  const quotaEmpty = (quota !== null && quota.left <= 0) || serverError?.code === "QUOTA_EXCEEDED";
  if (quotaEmpty) {
    const max = quota?.max ?? 3;
    const resetAt = serverError?.resetAt ?? quota?.resetAt;
    return {
      tone: "warning",
      blocked: true,
      banner: (
        <>
          <IconAlertTriangle aria-hidden className="size-3.5 shrink-0 text-warning" />
          <span>
            You used your {max} missions for today.
            {resetAt ? ` You get ${max} more at ${formatTimeOfDay(resetAt)}.` : ""}
          </span>
        </>
      ),
    };
  }

  return {
    tone: "neutral",
    blocked: false,
    banner: (
      <>
        <IconInfoCircle aria-hidden className="size-3.5 shrink-0" />
        <span className="tabular-nums">
          {unlimited
            ? "No daily mission limit on this deployment."
            : quota
              ? `${quota.left} of ${quota.max} missions left today.`
              : "Checking the missions left today…"}
        </span>
        <Link href="/usage" className="ml-auto shrink-0 text-link underline-offset-2 hover:underline">
          View usage
        </Link>
      </>
    ),
  };
}
