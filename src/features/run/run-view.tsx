"use client";

import { api } from "@convex/_generated/api";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { useMutation, type Preloaded } from "convex/react";
import { useEffect, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReportView } from "@/features/deliverable/report-view";
import { MissionGraph } from "@/features/mission-graph/mission-graph";
import { StreamPanel } from "@/features/mission-stream/stream-panel";
import { useShellData } from "@/features/shell/use-shell-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { isMissionActive } from "@/shared/events";
import { RunAnnouncer } from "./announcer";
import { MissionMetaContext, useMissionMeta, useMissionStatus } from "./mission-meta";
import { RunErrorBoundary } from "./run-error-boundary";
import { RunTopBar } from "./run-top-bar";
import { RunStoreContext, createRunStore, useRun, useRunStoreApi, type MobilePane, type RunTab } from "./store";
import { useLiveThoughts, useMissionEvents } from "./use-mission-events";

export function RunView({ preloadedMission }: { preloadedMission: Preloaded<typeof api.missions.get> }) {
  return (
    <RunErrorBoundary>
      <RunViewInner preloadedMission={preloadedMission} />
    </RunErrorBoundary>
  );
}

function RunViewInner({ preloadedMission }: { preloadedMission: Preloaded<typeof api.missions.get> }) {
  const meta = usePreloadedAuthQuery(preloadedMission);
  const [store] = useState(() => (meta ? createRunStore(meta._id) : null));
  // null only while the session ends: the auth guard moves to sign-in.
  if (!meta || !store) return null;
  return (
    <MissionMetaContext.Provider value={meta}>
      <RunStoreContext.Provider value={store}>
        <RunData />
        <RunLayout />
      </RunStoreContext.Provider>
    </MissionMetaContext.Provider>
  );
}

function RunData() {
  const store = useRunStoreApi();
  const meta = useMissionMeta();
  const { status } = useMissionStatus();
  useMissionEvents(store, meta._id);
  useLiveThoughts(store, meta._id, isMissionActive(status));

  // Opening a finished mission reads its Inbox items.
  const { unreadCount } = useShellData();
  const markMissionRead = useMutation(api.inbox.markAllRead);
  const finished = !isMissionActive(status);
  useEffect(() => {
    if (finished && unreadCount > 0) void markMissionRead({ missionId: meta._id }).catch(() => undefined);
  }, [finished, unreadCount, markMissionRead, meta._id]);
  return null;
}

/** 1024–1279px: the sidebar collapses on this route (design §6.3 widths). */
function useCompactSidebar() {
  const { open, setOpen, isMobile } = useSidebar();
  useEffect(() => {
    const width = window.innerWidth;
    if (isMobile || !open || width < 1024 || width >= 1280) return;
    setOpen(false);
    return () => setOpen(true);
    // Only on the first render of the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function RunLayout() {
  const isMobile = useIsMobile();
  const tab = useRun((state) => state.tab);
  const mobilePane = useRun((state) => state.mobilePane);
  const streamOpen = useRun((state) => state.streamOpen);
  const setTab = useRun((state) => state.setTab);
  const setMobilePane = useRun((state) => state.setMobilePane);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  useCompactSidebar();

  const value = isMobile ? mobilePane : tab;
  const onValueChange = (next: unknown) => {
    if (typeof next !== "string") return;
    if (isMobile) setMobilePane(next as MobilePane);
    else setTab(next === "activity" ? "graph" : (next as RunTab));
  };

  return (
    <Tabs value={value} onValueChange={onValueChange} className="flex h-dvh min-h-0 flex-col gap-0">
      <RunTopBar isMobile={isMobile} onAnnounce={setAnnouncement} />
      {isMobile ? (
        <>
          <TabsContent value="activity" keepMounted className="min-h-0 flex-1 data-hidden:hidden">
            <StreamPanel />
          </TabsContent>
          <TabsContent value="graph" keepMounted className="relative min-h-0 flex-1 bg-canvas data-hidden:hidden">
            <MissionGraph />
          </TabsContent>
          <TabsContent value="report" className="min-h-0 flex-1 overflow-y-auto">
            <ReportView />
          </TabsContent>
        </>
      ) : (
        <div className="flex min-h-0 flex-1">
          {streamOpen && (
            <aside aria-label="Mission stream" className="flex w-[360px] shrink-0 flex-col xl:w-[400px]">
              <StreamPanel />
            </aside>
          )}
          <div className={cn("relative m-2 min-w-0 flex-1 overflow-hidden rounded-xl bg-canvas shadow-raised", streamOpen && "ml-0")}>
            <TabsContent value="graph" keepMounted className="absolute inset-0 data-hidden:hidden">
              <MissionGraph />
            </TabsContent>
            <TabsContent value="report" className="absolute inset-0 overflow-y-auto bg-background">
              <ReportView />
            </TabsContent>
          </div>
        </div>
      )}
      <RunAnnouncer extra={announcement} />
    </Tabs>
  );
}
