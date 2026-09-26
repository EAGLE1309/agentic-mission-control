"use client";

import { IconChevronDown, IconDownload, IconFileText } from "@tabler/icons-react";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useRun } from "@/features/run/store";
import { useReportActions, useReportVersion } from "@/features/run/use-report";
import { sourceHost, stripSources } from "@/shared/report";

/** The Report tab (FR-24, FR-25, design §6.3). */
export function ReportView() {
  const versions = useRun((state) => state.view.versions);
  const setVersion = useRun((state) => state.setVersion);
  const version = useReportVersion();
  const { report, download } = useReportActions();

  if (versions.length === 0 || version === null) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <EmptyState icon={IconFileText} title="The report is not ready" description="The assembler writes it when the tasks finish." />
      </div>
    );
  }

  const entry = versions.find((item) => item.version === version);
  const latest = versions.at(-1)?.version ?? version;

  return (
    <article className="mx-auto flex w-full max-w-[65ch] flex-col px-4 py-10">
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="-ml-2.5" />}>
              <span className="tabular-nums">
                Version {version} of {versions.length}
              </span>
              <IconChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuRadioGroup
                  value={String(version)}
                  onValueChange={(next) => setVersion(Number(next) === latest ? null : Number(next))}
                >
                  {[...versions].reverse().map((item) => (
                    <DropdownMenuRadioItem key={item.version} value={String(item.version)}>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm text-foreground tabular-nums">
                          Version {item.version}
                          {item.version === latest && " (latest)"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{item.instruction ?? "First report"}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex items-center gap-1">
            <CopyButton text={report?.markdown ?? ""} label="Copy report" size="icon-sm" />
            <Button variant="outline" size="sm" disabled={!report} onClick={download}>
              <IconDownload data-icon="inline-start" />
              Download .md
            </Button>
          </div>
        </div>
        {version > 1 && entry?.instruction && (
          <p className="text-sm text-pretty text-muted-foreground">Changes: {entry.instruction}</p>
        )}
      </div>

      {report === undefined ? (
        <ReportSkeleton />
      ) : report === null ? (
        <EmptyState icon={IconFileText} title="This version is not available" description="Choose a different version of the report." />
      ) : (
        <>
          <Markdown>{stripSources(report.markdown)}</Markdown>
          {report.sources.length > 0 && (
            <section className="mt-10 flex flex-col gap-3" aria-labelledby="report-sources">
              <h2 id="report-sources" className="text-lg font-semibold">
                Sources
              </h2>
              <ol className="flex flex-col gap-2">
                {report.sources.map((item, index) => (
                  <li key={`${item.url}-${index}`} className="flex gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">{index + 1}.</span>
                    <span className="flex min-w-0 flex-col">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-link underline underline-offset-2 [overflow-wrap:anywhere]"
                      >
                        {item.title || item.url}
                      </a>
                      <span className="truncate font-mono text-xs text-muted-foreground">{sourceHost(item.url)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </article>
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-4 h-6 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-10/12" />
    </div>
  );
}
