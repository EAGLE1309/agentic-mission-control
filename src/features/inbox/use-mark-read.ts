"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

/** Mark one item read. The sidebar count drops at once (optimistic, design §6.7). */
export function useMarkRead() {
  return useMutation(api.inbox.markRead).withOptimisticUpdate((store) => {
    const summary = store.getQuery(api.shell.summary, {});
    if (summary) store.setQuery(api.shell.summary, {}, { ...summary, unreadCount: Math.max(0, summary.unreadCount - 1) });
  });
}

/** Mark all items read, or all items of one mission. */
export function useMarkAllRead() {
  return useMutation(api.inbox.markAllRead).withOptimisticUpdate((store, args) => {
    if (args.missionId) return;
    const summary = store.getQuery(api.shell.summary, {});
    if (summary) store.setQuery(api.shell.summary, {}, { ...summary, unreadCount: 0 });
  });
}
