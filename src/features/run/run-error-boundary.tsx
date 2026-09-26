"use client";

import { IconAlertTriangle, IconHistory } from "@tabler/icons-react";
import Link from "next/link";
import { Component, type ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { errorCode } from "@/shared/errors";

export function MissionNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <EmptyState
        icon={IconHistory}
        title="Mission not found"
        description="It does not exist, or a different account owns it."
        action={
          <Button size="sm" render={<Link href="/missions" />}>
            Go to missions
          </Button>
        }
      />
    </div>
  );
}

/** Errors from the mission queries (design §5.7): not found, or the page did not load. */
export class RunErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (errorCode(error) === "NOT_FOUND") return <MissionNotFound />;
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <EmptyState
          icon={IconAlertTriangle}
          title="This page did not load"
          description="Check your connection, then try again."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => window.location.reload()}>
                Try again
              </Button>
              <Button size="sm" variant="outline" render={<Link href="/missions" />}>
                Go to missions
              </Button>
            </div>
          }
        />
      </div>
    );
  }
}
