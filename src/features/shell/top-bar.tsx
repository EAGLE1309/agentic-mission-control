"use client";

import { IconLayoutSidebar } from "@tabler/icons-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { IconButton } from "@/components/icon-button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * The 48px top bar (design §6.1). The left side has the page title or a
 * breadcrumb. The right side has page actions in size sm.
 */
export function TopBar({
  title,
  crumbs,
  leading,
  titleAddon,
  actions,
  titleAs = "h1",
  className,
}: {
  title?: string;
  crumbs?: Crumb[];
  leading?: ReactNode;
  /** Shown right after the title or breadcrumb, for example a status badge. */
  titleAddon?: ReactNode;
  actions?: ReactNode;
  /** Use "p" when the page has its own h1 (Home). */
  titleAs?: "h1" | "p";
  className?: string;
}) {
  const { toggleSidebar } = useSidebar();
  const Title = titleAs;

  return (
    <header className={cn("sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4", className)}>
      <IconButton label="Open sidebar" className="-ml-1.5 md:hidden" onClick={toggleSidebar}>
        <IconLayoutSidebar />
      </IconButton>
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    <li className={cn(last ? "min-w-0" : "shrink-0")}>
                      {last || !crumb.href ? (
                        <Title
                          aria-current={last ? "page" : undefined}
                          title={crumb.label}
                          className={cn(
                            "truncate",
                            last ? "max-w-[40ch] font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {crumb.label}
                        </Title>
                      ) : (
                        <Link href={crumb.href} className="text-muted-foreground transition-[color] duration-150 hover:text-foreground">
                          {crumb.label}
                        </Link>
                      )}
                    </li>
                    {!last && (
                      <li aria-hidden className="text-muted-foreground">
                        /
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ol>
          </nav>
        ) : (
          title && <Title className="truncate text-sm font-medium text-foreground">{title}</Title>
        )}
        {titleAddon}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
