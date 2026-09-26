"use client";

import { api } from "@convex/_generated/api";
import { IconChevronDown, IconEdit, IconHistory, IconSearch } from "@tabler/icons-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { StatusIcon, missionStatusKind, statusSpec } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounced } from "@/hooks/use-debounced";
import { useNow } from "@/hooks/use-now";
import { formatDuration, formatRelativeDate, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isMissionActive } from "@/shared/events";

// Missions (FR-26, design §6.6).

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "stopped", label: "Stopped" },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

const PAGE_SIZE = 50;
const ROW_HEIGHT = 48;

export function MissionsView() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusValue>("all");
  const query = useDebounced(search.trim(), 300);
  const { results, status: loadStatus, loadMore } = usePaginatedQuery(
    api.missions.list,
    { status, ...(query ? { search: query } : {}) },
    { initialNumItems: PAGE_SIZE },
  );
  const filtered = query !== "" || status !== "all";
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "All";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <InputGroup className="h-8 w-full sm:w-72">
          <InputGroupAddon>
            <IconSearch aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search missions"
            aria-label="Search missions"
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            Status: {statusLabel}
            <IconChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup value={status} onValueChange={(next) => setStatus(next as StatusValue)}>
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div role="table" aria-label="Missions" aria-rowcount={results.length + 1} className="flex flex-1 flex-col">
        <div role="row" className="flex h-8 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
          <span role="columnheader" className="flex-1 pl-7">
            Mission
          </span>
          <span role="columnheader" className="hidden w-20 text-right md:block">
            Duration
          </span>
          <span role="columnheader" className="hidden w-16 text-right md:block">
            Tokens
          </span>
          <span role="columnheader" className="w-20 text-right">
            Date
          </span>
        </div>

        {loadStatus === "LoadingFirstPage" ? (
          <RowsSkeleton />
        ) : results.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={IconSearch}
              title={query ? `No missions match “${query}”` : "No missions match the filters"}
              description="Check the spelling, or clear the filters."
              action={
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
              className="min-h-80"
            />
          ) : (
            <EmptyState
              icon={IconHistory}
              title="No missions yet"
              description="Give the agents a goal. They plan it, research it, and write a report."
              action={
                <Button size="sm" render={<Link href="/home" />}>
                  <IconEdit data-icon="inline-start" />
                  New mission
                </Button>
              }
              className="min-h-80"
            />
          )
        ) : (
          <VirtualRows rows={results} onEnd={() => loadStatus === "CanLoadMore" && loadMore(PAGE_SIZE)} loadingMore={loadStatus === "LoadingMore"} />
        )}
      </div>
    </div>
  );
}

type Row = (typeof api.missions.list)["_returnType"]["page"][number];

/** Virtual rows (design §6.6): only the rows in view are in the DOM. */
function VirtualRows({ rows, onEnd, loadingMore }: { rows: Row[]; onEnd: () => void; loadingMore: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    setOffset(listRef.current?.offsetTop ?? 0);
  }, []);
  const virtualizer = useWindowVirtualizer({ count: rows.length, estimateSize: () => ROW_HEIGHT, overscan: 8, scrollMargin: offset });
  const items = virtualizer.getVirtualItems();
  const last = items.at(-1);

  // Load the next 50 rows when the end comes into view.
  useEffect(() => {
    if (last && last.index >= rows.length - 5) onEnd();
  }, [last, rows.length, onEnd]);

  const now = useNow(30_000);
  return (
    <div ref={listRef} role="rowgroup" className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((item) => {
        const row = rows[item.index];
        return (
          <div
            key={row._id}
            role="row"
            aria-rowindex={item.index + 2}
            className="absolute inset-x-0 border-b"
            style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            <MissionRow row={row} now={now} />
          </div>
        );
      })}
      {loadingMore && (
        <div className="absolute inset-x-0" style={{ top: virtualizer.getTotalSize() }}>
          <Skeleton className="mx-3 my-3 h-6" />
        </div>
      )}
    </div>
  );
}

function MissionRow({ row, now }: { row: Row; now: number }) {
  const active = isMissionActive(row.status);
  const kind = missionStatusKind(row.status, row.partial);
  const duration = active ? now - row.createdAt : row.durationMs ?? (row.endedAt ? row.endedAt - row.createdAt : null);
  return (
    <Link
      href={`/missions/${row._id}`}
      aria-label={`${row.title}, ${statusSpec(kind).label}`}
      className="flex h-12 items-center gap-3 px-3 transition-[background-color] duration-150 hover:bg-accent"
    >
      <span role="cell" className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-4 shrink-0 items-center justify-center">
          <StatusIcon status={kind} />
        </span>
        <span className="truncate text-sm text-foreground" title={row.title}>
          {row.title}
        </span>
      </span>
      <span role="cell" className={cn("hidden w-20 text-right text-xs text-muted-foreground tabular-nums md:block")}>
        {duration === null ? "—" : formatDuration(duration)}
      </span>
      <span role="cell" className="hidden w-16 text-right text-xs text-muted-foreground tabular-nums md:block">
        {formatTokens(row.tokens)}
      </span>
      <span role="cell" className="w-20 text-right text-xs text-muted-foreground tabular-nums">
        {formatRelativeDate(row.createdAt, now)}
      </span>
    </Link>
  );
}

function RowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading missions">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex h-12 items-center gap-3 border-b px-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-3 w-14 md:block" />
          <Skeleton className="hidden h-3 w-10 md:block" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}
