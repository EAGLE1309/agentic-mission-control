"use client";

import fixture from "@fixtures/missions/landing.json";
import { IconFileText, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { MissionGraph } from "@/features/mission-graph/mission-graph";
import { ActivityList, Narration, PlanList, StatusLine } from "@/features/mission-stream/stream-sections";
import { MissionMetaContext, type MissionMeta } from "@/features/run/mission-meta";
import { RunStoreContext, createRunStore, useRun } from "@/features/run/store";
import type { MissionEvent } from "@/shared/events";

// The landing demo (FR-1, design §6.12): a recorded mission plays on the real
// graph and stream, with the same reducer as the app. It needs no backend.

const IDLE_GAP_MS = 1_500;
const IDLE_GAP_TO_MS = 400;
const EVENTS = fixture.events as unknown as MissionEvent[];

/** Idle gaps over 1.5s become 400ms (tech spec §12.4). */
const OFFSETS = EVENTS.reduce<number[]>((offsets, event, index) => {
  if (index === 0) return [0];
  const gap = event.at - EVENTS[index - 1].at;
  offsets.push(offsets[index - 1] + (gap > IDLE_GAP_MS ? IDLE_GAP_TO_MS : Math.max(0, gap)));
  return offsets;
}, []);

function demoMeta(createdAt: number): MissionMeta {
  return {
    _id: "landing" as MissionMeta["_id"],
    title: fixture.goal.split(".")[0],
    goal: fixture.goal,
    status: "queued",
    partial: false,
    mode: "simulated",
    modelProfile: "balanced",
    revisionCount: 0,
    maxRevisions: 3,
    createdAt,
    endedAt: null,
    durationMs: null,
    lastSeq: 0,
    stats: { calls: 0, tokens: 0 },
  };
}

export function LandingDemo() {
  const reduced = useReducedMotion() ?? false;
  const [run, setRun] = useState(0);
  // With reduced motion, show the final state first, and play only on request.
  const autoPlay = !reduced || run > 0;
  return <DemoRun key={`${run}-${autoPlay}`} autoPlay={autoPlay} onReplay={() => setRun((count) => count + 1)} />;
}

function DemoRun({ autoPlay, onReplay }: { autoPlay: boolean; onReplay: () => void }) {
  const [start] = useState(() => Date.now());
  const [store] = useState(() => createRunStore("landing"));
  const [meta] = useState(() => demoMeta(start));
  const [done, setDone] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  // Pause when the demo is off screen or the tab is hidden.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const state = store.getState();
    state.setCursor(0);
    const rebase = (index: number): MissionEvent => ({ ...EVENTS[index], at: start + OFFSETS[index] });

    if (!autoPlay) {
      state.apply(EVENTS.map((_, index) => rebase(index)));
      const frame = requestAnimationFrame(() => setDone(true));
      return () => cancelAnimationFrame(frame);
    }

    let clock = 0;
    let index = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (visible.current && document.visibilityState === "visible") clock += delta;
      const batch: MissionEvent[] = [];
      while (index < EVENTS.length && OFFSETS[index] <= clock) {
        batch.push(rebase(index));
        index += 1;
      }
      if (batch.length > 0) store.getState().apply(batch);
      if (index >= EVENTS.length) {
        setDone(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoPlay, start, store]);

  return (
    <MissionMetaContext.Provider value={meta}>
      <RunStoreContext.Provider value={store}>
        <div
          ref={frameRef}
          role="region"
          aria-label="A recorded mission, playing on the live graph"
          className="relative overflow-hidden rounded-2xl bg-sidebar shadow-raised"
        >
          <div className="flex h-[520px] md:h-[560px]">
            <div className="hidden w-[340px] shrink-0 md:flex">
              <DemoStream />
            </div>
            <div className="relative m-2 min-w-0 flex-1 overflow-hidden rounded-xl bg-canvas shadow-raised md:ml-0">
              <MissionGraph interactive={false} />
            </div>
          </div>
          {done && (
            <div className="absolute top-4 right-4 z-30">
              <Button variant="outline" size="sm" onClick={onReplay}>
                {autoPlay ? <IconRefresh data-icon="inline-start" /> : <IconPlayerPlay data-icon="inline-start" />}
                {autoPlay ? "Replay" : "Play"}
              </Button>
            </div>
          )}
        </div>
      </RunStoreContext.Provider>
    </MissionMetaContext.Provider>
  );
}

function DemoStream() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 bg-background p-3">
      <div className="rounded-xl bg-card p-3 shadow-raised">
        <p className="line-clamp-3 text-sm text-foreground">{fixture.goal}</p>
      </div>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Mission activity" className="-mx-1 px-1">
            <MessageScrollerContent className="gap-4 py-1">
              <MessageScrollerItem messageId="narration">
                <Narration />
              </MessageScrollerItem>
              <MessageScrollerItem messageId="status">
                <StatusLine />
              </MessageScrollerItem>
              <MessageScrollerItem messageId="plan">
                <PlanList />
              </MessageScrollerItem>
              <MessageScrollerItem messageId="activity">
                <ActivityList />
              </MessageScrollerItem>
              <MessageScrollerItem messageId="report">
                <DemoReportCard />
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}

function DemoReportCard() {
  const latest = useRun((state) => state.view.versions.at(-1));
  if (!latest) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-raised animate-in fade-in-0 duration-200 ease-out">
      <IconFileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">Report v{latest.version} is ready</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {latest.words} words · {latest.sourceCount} sources
      </span>
    </div>
  );
}
