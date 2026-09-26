"use client";

import { api } from "@convex/_generated/api";
import { IconEdit, IconGauge } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useShellData } from "@/features/shell/use-shell-data";
import { formatTimeOfDay, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";

// Usage (FR-28, design §6.9). No row of big number tiles.

const CAPACITY = {
  available: { label: "Available", variant: "neutral" },
  low: { label: "Low", variant: "warning" },
  reached: { label: "Reached", variant: "destructive" },
} as const;

export function UsageView() {
  const { quota, capacity } = useShellData();
  const totals = useQuery(api.usage.summary);
  const level = capacity?.level ?? "available";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 md:px-6">
      <Section title="Today" description="Each account can start a few missions each day. All accounts share the model capacity.">
        <div className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-raised">
          {quota ? (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {quota.left} of {quota.max} missions left
              </p>
              <Progress
                value={quota.max > 0 ? (quota.left / quota.max) * 100 : 0}
                aria-label="Missions left today"
                className={cn(
                  "[&_[data-slot=progress-track]]:h-1.5",
                  quota.left <= 0 ? "[&_[data-slot=progress-indicator]]:bg-warning" : "[&_[data-slot=progress-indicator]]:bg-foreground",
                )}
              />
              <p className="text-sm text-muted-foreground">Resets at {formatTimeOfDay(quota.resetAt)}</p>
            </>
          ) : (
            <div aria-busy="true" className="flex flex-col gap-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-sm text-foreground">Shared capacity</span>
            <Badge variant={CAPACITY[level].variant}>{CAPACITY[level].label}</Badge>
          </div>
        </div>
      </Section>

      <Section title="All time" description="Your missions and the tokens they used.">
        {totals === undefined ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : totals.missions === 0 ? (
          <EmptyState
            icon={IconGauge}
            title="No usage yet"
            description="Your mission and token totals show here."
            action={
              <Button size="sm" render={<Link href="/home" />}>
                <IconEdit data-icon="inline-start" />
                New mission
              </Button>
            }
            className="rounded-lg bg-card shadow-raised"
          />
        ) : (
          <dl className="divide-y rounded-lg bg-card shadow-raised">
            <Row label="Missions" value={totals.missions.toLocaleString()} />
            <Row label="Tokens" value={formatTokens(totals.tokens)} title={totals.tokens.toLocaleString()} />
          </dl>
        )}
      </Section>
    </div>
  );
}

function Row({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex h-12 items-center justify-between px-4">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums" title={title}>
        {value}
      </dd>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
