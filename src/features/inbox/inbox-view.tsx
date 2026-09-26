"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconInbox } from "@tabler/icons-react";
import { usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { SegmentedTab, SegmentedTabsList } from "@/components/segmented-tabs";
import { StatusIcon, missionStatusKind } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { toastTimeout } from "@/features/shell/finish-toasts";
import { TopBar } from "@/features/shell/top-bar";
import { useShellData } from "@/features/shell/use-shell-data";
import { useNow } from "@/hooks/use-now";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarkAllRead, useMarkRead } from "./use-mark-read";

// Inbox (FR-27, design §6.7).

const PAGE_SIZE = 30;

type Item = (typeof api.inbox.list)["_returnType"]["page"][number];

export function InboxView() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const { unreadCount } = useShellData();
  const markAllRead = useMarkAllRead();
  const { results, status, loadMore } = usePaginatedQuery(
    api.inbox.list,
    { unreadOnly: tab === "unread" },
    { initialNumItems: PAGE_SIZE },
  );

  const markAll = async () => {
    try {
      await markAllRead({});
    } catch {
      const title = "The items were not marked as read. Check your connection, then try again.";
      toast.add({ title, timeout: toastTimeout(title) });
    }
  };

  return (
    <>
      <TopBar
        title="Inbox"
        actions={
          <Button variant="ghost" size="sm" disabled={unreadCount === 0} onClick={() => void markAll()}>
            Mark all as read
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 md:px-6">
        <Tabs value={tab} onValueChange={(next) => setTab(next === "unread" ? "unread" : "all")}>
          <SegmentedTabsList aria-label="Inbox filter">
            <SegmentedTab value="all">All</SegmentedTab>
            <SegmentedTab value="unread">Unread</SegmentedTab>
          </SegmentedTabsList>
        </Tabs>

        {status === "LoadingFirstPage" ? (
          <div aria-busy="true" aria-label="Loading the inbox" className="divide-y">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex h-12 items-center gap-3 px-3">
                <Skeleton className="size-1.5 rounded-full" />
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={IconInbox}
            title={tab === "unread" ? "No unread notifications" : "Inbox is empty"}
            description={
              tab === "unread" ? "You read each notification." : "You get a notification when a mission completes or fails."
            }
            className="min-h-80"
          />
        ) : (
          <>
            <ul className="divide-y">
              {results.map((item) => (
                <InboxRow key={item._id} item={item} />
              ))}
            </ul>
            {status === "CanLoadMore" && (
              <Button variant="outline" size="sm" className="self-center" onClick={() => loadMore(PAGE_SIZE)}>
                Show more
              </Button>
            )}
            {status === "LoadingMore" && <Skeleton className="mx-3 h-6" />}
          </>
        )}
      </div>
    </>
  );
}

function InboxRow({ item }: { item: Item }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const now = useNow(60_000);
  const unread = item.readAt === null;
  const failed = item.kind === "mission_failed";
  const kind = failed ? "failed" : item.status ? missionStatusKind(item.status, item.partial) : "completed";
  const verb = failed ? "failed" : item.partial ? "completed with missing parts" : "completed";

  const open = () => {
    // Mark it read at once; navigation does not wait for the server.
    if (unread) void markRead({ itemId: item._id as Id<"inboxItems"> }).catch(() => undefined);
    router.push(`/missions/${item.missionId}`);
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-left transition-[background-color] duration-150 hover:bg-accent"
      >
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", unread && "bg-live")} />
        <StatusIcon status={kind} />
        <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
          “{item.title}” {verb}
          {unread && <span className="sr-only"> (unread)</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatRelativeDate(item.createdAt, now)}</span>
      </button>
    </li>
  );
}
