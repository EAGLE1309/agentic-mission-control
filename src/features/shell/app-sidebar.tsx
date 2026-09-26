"use client";

import { IconLayoutSidebar, IconSearch } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconButton } from "@/components/icon-button";
import { Mark } from "@/components/mark";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShortcutLabel } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";
import { AGENT_NAV, PRIMARY_NAV, SECONDARY_NAV, isNavActive, type NavItem } from "./nav";
import { useShell } from "./shell-context";
import { useShellData } from "./use-shell-data";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "./user-avatar";

export function AppSidebar({ user }: { user: CurrentUser | null | undefined }) {
  const pathname = usePathname();
  const { unreadCount, quota, activeRoles } = useShellData();
  const { setPaletteOpen } = useShell();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const toggleShortcut = useShortcutLabel("b");
  const searchShortcut = useShortcutLabel("k");

  // The mobile sidebar is a sheet. Close it when the user picks a page.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const navLink = (item: NavItem, badge?: number) => {
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          render={<Link href={item.href} onClick={closeOnMobile} />}
          isActive={isNavActive(pathname, item.href)}
          tooltip={item.label}
        >
          <Icon aria-hidden className="text-muted-foreground" />
          <span>{item.label}</span>
        </SidebarMenuButton>
        {badge !== undefined && badge > 0 && (
          <SidebarMenuBadge className="bg-muted" aria-label={`${badge} unread`}>
            {badge > 99 ? "99+" : badge}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 pl-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
          <Mark className="text-foreground group-data-[collapsible=icon]:hidden" />
          <span className="flex-1 truncate text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">
            Mission Control
          </span>
          <IconButton label="Toggle sidebar" shortcut={toggleShortcut} side="right" onClick={toggleSidebar}>
            <IconLayoutSidebar />
          </IconButton>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={{ children: <>Search <Kbd>{searchShortcut}</Kbd></> }}
              onClick={() => {
                closeOnMobile();
                setPaletteOpen(true);
              }}
              className="border border-input bg-background text-muted-foreground hover:bg-background hover:text-muted-foreground group-data-[collapsible=icon]:border-transparent"
              aria-label="Search"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <IconSearch aria-hidden />
              <span className="flex-1">Search…</span>
              <Kbd className="group-data-[collapsible=icon]:hidden">{searchShortcut}</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>{PRIMARY_NAV.map((item) => navLink(item, item.href === "/inbox" ? unreadCount : undefined))}</SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarMenu>{SECONDARY_NAV.map((item) => navLink(item))}</SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-muted-foreground">Agents</SidebarGroupLabel>
          <SidebarMenu>
            {AGENT_NAV.map((agent) => {
              const Icon = agent.icon;
              const running = activeRoles[agent.role] ?? 0;
              const status = running > 0 ? `Running in ${running} ${running === 1 ? "mission" : "missions"}` : "Idle";
              return (
                <SidebarMenuItem key={agent.role}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          render={<Link href={`/agents#${agent.role}`} onClick={closeOnMobile} />}
                          aria-label={`${agent.label} agent, ${status.toLowerCase()}`}
                        />
                      }
                    >
                      <Icon aria-hidden className="text-muted-foreground" />
                      <span className="flex-1 truncate">{agent.label}</span>
                      <LiveDot active={running > 0} />
                    </TooltipTrigger>
                    <TooltipContent side="right">{status}</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <QuotaCard quota={quota} onNavigate={closeOnMobile} />
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

/** 6px live dot (design §5.3). Hollow when idle, blue with a pulse when active. */
function LiveDot({ active }: { active: boolean }) {
  return (
    <span aria-hidden className="relative mr-1 flex size-1.5 shrink-0">
      {active && <span className="absolute inset-0 rounded-full bg-live motion-safe:animate-live-pulse" />}
      <span className={cn("relative size-1.5 rounded-full", active ? "bg-live" : "border border-muted-foreground/60")} />
    </span>
  );
}

function QuotaCard({ quota, onNavigate }: { quota: { left: number; max: number } | null; onNavigate: () => void }) {
  const empty = quota !== null && quota.left <= 0;
  return (
    <Link
      href="/usage"
      onClick={onNavigate}
      aria-label={quota ? `Missions today: ${quota.left} of ${quota.max} left. Open usage.` : "Open usage"}
      className="flex flex-col gap-2 rounded-lg bg-card p-3 shadow-raised transition-[box-shadow] duration-150 hover:shadow-raised-hover group-data-[collapsible=icon]:hidden"
    >
      <span className="text-xs text-muted-foreground">Missions today</span>
      {quota ? (
        <span className="text-sm text-foreground tabular-nums">
          {quota.left} of {quota.max} left
        </span>
      ) : (
        <Skeleton className="h-5 w-20" />
      )}
      <Progress
        value={quota && quota.max > 0 ? (Math.max(0, quota.left) / quota.max) * 100 : 0}
        aria-hidden
        className={cn(
          "[&_[data-slot=progress-track]]:h-1",
          empty ? "[&_[data-slot=progress-indicator]]:bg-warning" : "[&_[data-slot=progress-indicator]]:bg-foreground",
        )}
      />
    </Link>
  );
}
