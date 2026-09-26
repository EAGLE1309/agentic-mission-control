"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCallback } from "react";
import { useMissionTitle } from "./mission-meta";
import { useRun } from "./store";

/** The report version on screen: the chosen one, or the latest. null before v1. */
export function useReportVersion(): number | null {
  const chosen = useRun((state) => state.version);
  const latest = useRun((state) => state.view.versions.at(-1)?.version ?? null);
  return chosen ?? latest;
}

export function useReportDocument() {
  const missionId = useRun((state) => state.missionId) as Id<"missions">;
  const version = useReportVersion();
  return useQuery(api.deliverables.get, version === null ? "skip" : { missionId, version });
}

function fileName(title: string, version: number): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "report";
  return `${base}-v${version}.md`;
}

/** Copy the report markdown, or download it as .md (FR-24). */
export function useReportActions() {
  const report = useReportDocument();
  const title = useMissionTitle();

  const copy = useCallback(async (): Promise<boolean> => {
    if (!report) return false;
    try {
      await navigator.clipboard.writeText(report.markdown);
      return true;
    } catch {
      return false;
    }
  }, [report]);

  const download = useCallback(() => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName(title, report.version);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, [report, title]);

  return { report, ready: report !== undefined && report !== null, copy, download };
}
