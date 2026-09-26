"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/features/shell/user-avatar";

/** Profile (FR-4, design §6.10): read-only, from the sign-in method. */
export function ProfileCard() {
  const user = useQuery(api.auth.getCurrentUser);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-raised">
      {user ? (
        <>
          <UserAvatar user={user} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground" title={user.name}>
              {user.name || "No name"}
            </span>
            <span className="truncate text-sm text-muted-foreground" title={user.email}>
              {user.email}
            </span>
          </div>
        </>
      ) : (
        <>
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        </>
      )}
    </div>
  );
}
