"use client";

import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";
import type { MissionStatus } from "@/shared/events";
import { useRun } from "./store";

export type MissionMeta = FunctionReturnType<typeof api.missions.get>;

export const MissionMetaContext = createContext<MissionMeta | null>(null);

export function useMissionMeta(): MissionMeta {
  const meta = useContext(MissionMetaContext);
  if (!meta) throw new Error("useMissionMeta must be used inside MissionMetaContext.");
  return meta;
}

/**
 * The mission status: from the events when they are loaded, else from the
 * preloaded mission row, so the first paint already shows the right state.
 */
export function useMissionStatus(): { status: MissionStatus; partial: boolean } {
  const meta = useMissionMeta();
  const loaded = useRun((state) => state.view.lastSeq > 0);
  const status = useRun((state) => state.view.status);
  const partial = useRun((state) => state.view.partial);
  return loaded ? { status, partial } : { status: meta.status, partial: meta.partial };
}

export function useMissionTitle(): string {
  const meta = useMissionMeta();
  const title = useRun((state) => state.view.title);
  return title ?? meta.title;
}
