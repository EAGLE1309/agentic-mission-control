"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useConvex, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useStore, type StoreApi } from "zustand";
import { EVENTS_PAGE_SIZE, EVENTS_TAIL_ADVANCE_AT } from "@/shared/constants";
import type { RunState } from "./store";

/**
 * Event loading (tech spec §9.1):
 * 1. Get the history with events.page, 500 events at a time.
 * 2. Subscribe to events.tail(afterSeq). It returns 200 events at most.
 * 3. At 150 events, move the cursor forward, so each update stays small.
 * The reducer skips events it already has, so overlaps are safe.
 */
export function useMissionEvents(store: StoreApi<RunState>, missionId: Id<"missions">) {
  const convex = useConvex();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let after = 0;
      for (;;) {
        const page = await convex.query(api.events.page, { missionId, afterSeq: after });
        if (cancelled) return;
        store.getState().apply(page);
        const last = page.at(-1);
        if (!last || page.length < EVENTS_PAGE_SIZE) break;
        after = last.seq;
      }
      if (!cancelled) store.getState().setCursor(store.getState().view.lastSeq);
    })().catch((caught: unknown) => {
      if (!cancelled) setError(caught);
    });
    return () => {
      cancelled = true;
    };
  }, [convex, missionId, store]);

  const cursor = useStore(store, (state) => state.cursor);
  const tail = useQuery(api.events.tail, cursor === null ? "skip" : { missionId, afterSeq: cursor });

  useEffect(() => {
    if (!tail || tail.length === 0) return;
    const state = store.getState();
    state.apply(tail);
    const last = tail.at(-1);
    if (last && tail.length >= EVENTS_TAIL_ADVANCE_AT) state.setCursor(last.seq);
  }, [store, tail]);

  // An error in the history load shows in the same boundary as query errors.
  if (error) throw error;
}


/** Live thoughts come from a separate subscription. Replay does not use them. */
export function useLiveThoughts(store: StoreApi<RunState>, missionId: Id<"missions">, enabled: boolean) {
  const rows = useQuery(api.live.forMission, enabled ? { missionId } : "skip");
  useEffect(() => {
    if (!rows) return;
    store.getState().setLive(Object.fromEntries(rows.map((row) => [row.nodeId, row.text])));
  }, [rows, store]);
}
