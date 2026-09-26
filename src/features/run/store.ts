"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { MissionEvent } from "@/shared/events";
import { applyEvents, initialMissionView, type MissionView } from "@/shared/reducer";

// One store for each run view (tech spec §2). Components read only their own
// part, so a live thought updates only one node.

export type RunTab = "graph" | "report";
export type MobilePane = "activity" | "graph" | "report";

export type RunState = {
  missionId: string;
  view: MissionView;
  /** True when the history is loaded and the tail subscription runs. */
  loaded: boolean;
  /** The afterSeq of the tail subscription. null while the history loads. */
  cursor: number | null;
  /** Packets up to this seq were in the history, so they do not animate (tech spec §9.2). */
  animateFrom: number;
  live: Record<string, string>;
  selectedNodeId: string | null;
  followMode: boolean;
  streamOpen: boolean;
  tab: RunTab;
  mobilePane: MobilePane;
  /** The report version on screen. null means the latest. */
  version: number | null;

  apply: (events: readonly MissionEvent[]) => void;
  setCursor: (cursor: number) => void;
  setLive: (live: Record<string, string>) => void;
  select: (nodeId: string | null) => void;
  /** Select a task and show the graph, where its trace opens. */
  openTrace: (nodeId: string) => void;
  setFollowMode: (on: boolean) => void;
  toggleStream: () => void;
  setTab: (tab: RunTab) => void;
  setMobilePane: (pane: MobilePane) => void;
  setVersion: (version: number | null) => void;
};

export function createRunStore(missionId: string): StoreApi<RunState> {
  return createStore<RunState>()((set) => ({
    missionId,
    view: initialMissionView(),
    loaded: false,
    cursor: null,
    animateFrom: Number.POSITIVE_INFINITY,
    live: {},
    selectedNodeId: null,
    followMode: true,
    streamOpen: true,
    tab: "graph",
    mobilePane: "graph",
    version: null,

    apply: (events) =>
      set((state) => {
        const view = applyEvents(state.view, events);
        return view === state.view ? state : { view };
      }),
    setCursor: (cursor) =>
      set((state) => ({
        cursor,
        loaded: true,
        animateFrom: state.loaded ? state.animateFrom : state.view.lastSeq,
      })),
    setLive: (live) => set({ live }),
    select: (selectedNodeId) => set({ selectedNodeId }),
    openTrace: (selectedNodeId) => set({ selectedNodeId, tab: "graph" }),
    setFollowMode: (followMode) => set({ followMode }),
    toggleStream: () => set((state) => ({ streamOpen: !state.streamOpen })),
    // The desktop tab and the narrow-screen pane stay in step across a resize.
    setTab: (tab) => set({ tab, mobilePane: tab }),
    setMobilePane: (mobilePane) => set((state) => ({ mobilePane, tab: mobilePane === "activity" ? state.tab : mobilePane })),
    setVersion: (version) => set({ version }),
  }));
}

export const RunStoreContext = createContext<StoreApi<RunState> | null>(null);

export function useRunStoreApi(): StoreApi<RunState> {
  const store = useContext(RunStoreContext);
  if (!store) throw new Error("useRunStore must be used inside RunStoreContext.");
  return store;
}

export function useRun<T>(selector: (state: RunState) => T): T {
  return useStore(useRunStoreApi(), selector);
}
