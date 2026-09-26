"use client";

import { IconArrowDown } from "@tabler/icons-react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { GoalCard } from "./goal-card";
import { RevisionComposer } from "./revision-composer";
import { ActivityList, Narration, PlanList, ReportCard, StatusLine } from "./stream-sections";

/**
 * The stream (FR-21, design §6.3): goal card on top, the items in a
 * MessageScroller, and the composer fixed at the bottom. MessageScroller
 * follows new content while the user is at the bottom.
 */
export function StreamPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <GoalCard />
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
                <ReportCard />
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" variant="outline" size="sm" className="bottom-2 h-8 gap-1.5 rounded-full px-3 text-xs">
            <IconArrowDown data-icon="inline-start" />
            Jump to latest
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
      <span id="revision-label" className="sr-only">
        Ask for changes to the report
      </span>
      <RevisionComposer />
    </div>
  );
}
