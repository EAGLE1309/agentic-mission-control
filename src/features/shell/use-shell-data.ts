"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import type { AgentRole } from "@/shared/agents";

type WindowValue = { value: number; windowStart: number; period: number; max: number };

export type Quota = { left: number; max: number; resetAt: number };
export type Capacity = "available" | "low" | "reached";

export type ShellData = {
  /** Unread Inbox items. Hidden at 0. */
  unreadCount: number;
  /** Missions left today. null while it loads. */
  quota: Quota | null;
  /** Shared model capacity (FR-9). null in simulated mode or while it loads. */
  capacity: { level: Capacity; resetAt: number } | null;
  /** Missions of this user that run a task with each role now. */
  activeRoles: Partial<Record<AgentRole, number>>;
  recentMissions: { id: string; title: string }[];
};

/** The value of a fixed window now: a window that ended is full again. */
export function windowNow(window: WindowValue, now: number): { left: number; resetAt: number } {
  const end = window.windowStart + window.period;
  if (now >= end) {
    const next = (Math.floor(now / window.period) + 1) * window.period;
    return { left: window.max, resetAt: next };
  }
  return { left: Math.max(0, Math.floor(window.value)), resetAt: end };
}

/** A clock that ticks each minute, so a quota reset shows without a reload. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Live data for the sidebar, the command palette, and the composer banner. */
export function useShellData(): ShellData {
  const summary = useQuery(api.shell.summary);
  const now = useMinuteClock();

  if (!summary) return { unreadCount: 0, quota: null, capacity: null, activeRoles: {}, recentMissions: [] };

  const quota = windowNow(summary.quota, now);
  let capacity: ShellData["capacity"] = null;
  if (summary.capacity) {
    const current = windowNow(summary.capacity, now);
    const level: Capacity =
      current.left < summary.capacity.minimum ? "reached" : current.left < summary.capacity.max * 0.2 ? "low" : "available";
    capacity = { level, resetAt: current.resetAt };
  }

  return {
    unreadCount: summary.unreadCount,
    quota: { left: quota.left, max: summary.quota.max, resetAt: quota.resetAt },
    capacity,
    activeRoles: summary.activeRoles,
    recentMissions: summary.recentMissions,
  };
}
