"use client";

import { IconWorld } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Site favicons for the pages the agents find and read (design §6.4). The
// icons come from the DuckDuckGo icon service: it needs no key and does not
// set cookies. A site without an icon shows a globe.

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/** The host of a URL or of a host string, without "www.", or null when it is not a web host. */
export function faviconHost(urlOrHost: string): string | null {
  let host = urlOrHost;
  try {
    if (/^https?:\/\//i.test(urlOrHost)) host = new URL(urlOrHost).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./i, "").toLowerCase();
  return HOST.test(host) ? host : null;
}

/**
 * One site icon on a light tile. Many favicons are black, so without the tile
 * they vanish on a dark surface; browser tabs solve it the same way.
 */
export function Favicon({ site, className }: { site: string; className?: string }) {
  const host = faviconHost(site);
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-favicon-tile ring-1 ring-image-outline",
        className,
      )}
    >
      {!host || failed ? (
        <IconWorld className="size-3 text-favicon-tile-foreground" />
      ) : (
        // A 12px third-party icon: next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
          alt=""
          width={12}
          height={12}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-3"
        />
      )}
    </span>
  );
}

/**
 * The favicons of several pages, newest first, with the hosts in a tooltip
 * text. A new icon fades in, so sites appear as the agents find them.
 */
export function FaviconStack({ sites, max = 4, className }: { sites: readonly string[]; max?: number; className?: string }) {
  const hosts = [...new Set(sites.map(faviconHost).filter((host): host is string => host !== null))];
  if (hosts.length === 0) return null;
  const shown = hosts.slice(0, max);
  const more = hosts.length - shown.length;
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)} title={hosts.join(", ")}>
      {shown.map((host) => (
        <span key={host} className="flex animate-in fade-in-0 zoom-in-75 duration-200 ease-out motion-reduce:animate-none">
          <Favicon site={host} />
        </span>
      ))}
      {more > 0 && <span className="text-xs text-muted-foreground tabular-nums">+{more}</span>}
      <span className="sr-only">Sites: {hosts.join(", ")}</span>
    </span>
  );
}
