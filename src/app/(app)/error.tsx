"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// Network or unknown error (design §5.7, §5.8).
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <EmptyState
        icon={IconAlertTriangle}
        title="This page did not load"
        description="Check your connection, then try again."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={reset}>
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
