"use client";

import { IconArrowLeft, IconCopy, IconDots, IconDownload } from "@tabler/icons-react";
import Link from "next/link";
import { IconButton } from "@/components/icon-button";
import { SegmentedTab, SegmentedTabsList } from "@/components/segmented-tabs";
import { StatusBadge, StatusIcon, missionStatusKind } from "@/components/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TopBar } from "@/features/shell/top-bar";
import { useMissionStatus, useMissionTitle } from "./mission-meta";
import { useRun } from "./store";
import { useReportActions } from "./use-report";

/** Run view top bar (design §6.3): back, breadcrumb, status, tabs, overflow menu. */
export function RunTopBar({ isMobile, onAnnounce }: { isMobile: boolean; onAnnounce: (message: string) => void }) {
  const title = useMissionTitle();
  const { status, partial } = useMissionStatus();
  const hasReport = useRun((state) => state.view.versions.length > 0);
  const { ready, copy, download } = useReportActions();
  const kind = missionStatusKind(status, partial);

  return (
    <TopBar
      leading={
        <IconButton label="Back to missions" className="hidden md:inline-flex" render={<Link href="/missions" />}>
          <IconArrowLeft />
        </IconButton>
      }
      crumbs={isMobile ? [{ label: title }] : [{ label: "Missions", href: "/missions" }, { label: title }]}
      titleAddon={isMobile ? <StatusIcon status={kind} /> : <StatusBadge status={kind} className="shrink-0" />}
      actions={
        <>
          <SegmentedTabsList aria-label="Mission views">
            {isMobile && <SegmentedTab value="activity">Activity</SegmentedTab>}
            <SegmentedTab value="graph">Graph</SegmentedTab>
            <SegmentedTab value="report" disabled={!hasReport}>
              Report
            </SegmentedTab>
          </SegmentedTabsList>
          <DropdownMenu>
            <DropdownMenuTrigger render={<IconButton label="More actions" />}>
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={!ready}
                  onClick={async () => onAnnounce((await copy()) ? "Copied." : "The report was not copied.")}
                >
                  <IconCopy aria-hidden />
                  Copy report
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!ready} onClick={download}>
                  <IconDownload aria-hidden />
                  Download .md
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
