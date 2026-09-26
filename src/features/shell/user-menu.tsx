"use client";

import { IconLogout, IconSelector, IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "./theme-toggle";
import { useSignOut } from "./use-sign-out";
import { UserAvatar, type CurrentUser } from "./user-avatar";

/** User block and menu (design §6.1, Strove). The menu opens upward. */
export function UserMenu({ user }: { user: CurrentUser | null | undefined }) {
  const { signOut, pending } = useSignOut();

  if (!user) {
    return (
      <div className="flex h-12 items-center gap-2 px-2" aria-hidden>
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="rounded-lg" aria-label={`Account menu for ${user.name || user.email}`} />
            }
          >
            <UserAvatar user={user} />
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="truncate text-sm font-medium text-foreground">{user.name || user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <IconSelector aria-hidden className="ml-auto text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6} className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <IconSettings aria-hidden />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <div className="px-1 py-1.5">
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={pending}
                closeOnClick={false}
                onClick={() => {
                  void signOut();
                }}
              >
                {pending ? <Spinner aria-hidden /> : <IconLogout aria-hidden />}
                {pending ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
