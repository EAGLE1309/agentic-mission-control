"use client";

import { IconFlask } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AppMark } from "@/components/app-mark";
import { Mark } from "@/components/mark";
import { BrandMark } from "@/components/provider-mark";
import { cn } from "@/lib/utils";
import type { AppSlug } from "@/shared/apps";
import { SEARCH_ORDER } from "@/shared/constants";
import { isLive, searchServices, service, type ServiceStatus } from "./catalog";

// The hero of the Integrations page (design §6.8): the services around the
// app, drawn like the mission graph. Edges show state (design §1): a moving
// blue edge is connected, a gray dotted edge is not set up.

const HEIGHT = 256;
const HUB_WIDTH = 216;
const WIDE = 720;

type MapNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  sub: string;
  marks: ReactNode;
  live: boolean;
  /** The node the edge goes to. */
  to: "hub" | string;
};

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ConnectionMap({
  status,
  providers,
  freeModels,
  apps,
}: {
  status: ServiceStatus;
  /** Brand keys of the model makers in the chains. */
  providers: string[];
  /** Free models in the catalog, or 0 while it is empty. */
  freeModels: number;
  /** Connected apps. */
  apps: AppSlug[];
}) {
  const [ref, width] = useWidth();
  const reduced = useReducedMotion();
  const models = isLive(service("openrouter").state(status));
  const search = searchServices(status);
  const nodes: MapNode[] = [
    {
      id: "openrouter",
      x: 0.2,
      y: 0.3,
      label: "OpenRouter",
      sub: freeModels > 0 ? `${freeModels} free models` : "Free models",
      marks: <BrandMark brand="openrouter" className="size-4" />,
      live: models,
      to: "hub",
    },
    {
      id: "makers",
      x: 0.2,
      y: 0.74,
      label: "Model makers",
      sub: `${providers.length} in use`,
      marks: providers.slice(0, 3).map((brand) => <BrandMark key={brand} brand={brand} className="size-3.5" />),
      live: models,
      to: "openrouter",
    },
    {
      id: "search",
      x: 0.8,
      y: 0.22,
      label: "Web search",
      sub: search.length > 0 ? search.map((item) => item.name).join(", ") : "Not set up",
      marks: (search.length > 0 ? search.map((item) => item.brand) : SEARCH_ORDER).map((brand) => (
        <BrandMark key={brand} brand={brand} className="size-3.5" />
      )),
      live: search.length > 0,
      to: "hub",
    },
    {
      id: "jina",
      x: 0.8,
      y: 0.5,
      label: "Jina Reader",
      sub: "Page reader",
      marks: <BrandMark brand="jina" className="size-4" />,
      live: isLive(service("jina").state(status)),
      to: "hub",
    },
    {
      id: "apps",
      x: 0.8,
      y: 0.78,
      label: "Your apps",
      sub: apps.length > 0 ? `${apps.length} connected` : "None connected",
      marks: (apps.length > 0 ? apps : (["slack", "notion", "github"] as AppSlug[]))
        .slice(0, 3)
        .map((slug) => <AppMark key={slug} slug={slug} className="size-3.5" />),
      live: apps.length > 0,
      to: "hub",
    },
  ];

  const counted = nodes.filter((node) => node.id !== "makers");
  const connected = counted.filter((node) => node.live).length;
  const wide = width >= WIDE;
  const hub = { x: width / 2, y: HEIGHT / 2 };
  const point = (node: MapNode) => ({ x: node.x * width, y: node.y * HEIGHT });

  const edges = nodes.map((node) => {
    const from = point(node);
    let d: string;
    if (node.to === "hub") {
      const tx = hub.x + (from.x < hub.x ? -HUB_WIDTH / 2 : HUB_WIDTH / 2);
      const mx = (from.x + tx) / 2;
      d = `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${hub.y}, ${tx} ${hub.y}`;
    } else {
      const target = point(nodes.find((item) => item.id === node.to) ?? node);
      d = `M ${from.x} ${from.y} L ${target.x} ${target.y}`;
    }
    return { id: node.id, d, live: node.live };
  });

  return (
    <section
      aria-label={`Connections: ${connected} of ${counted.length} connected`}
      className="relative overflow-hidden rounded-xl bg-canvas shadow-raised bg-dot-grid"
    >
      <div ref={ref} className={cn("relative", wide ? "h-64" : "flex flex-col items-center gap-4 p-4")}>
        {wide && (
          <svg aria-hidden className="absolute inset-0 size-full" width={width} height={HEIGHT}>
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                className={
                  edge.live
                    ? "stroke-live [stroke-dasharray:1_5] animate-edge-flow motion-reduce:animate-none"
                    : "stroke-muted-foreground/40 [stroke-dasharray:1_5]"
                }
              />
            ))}
            {!reduced &&
              edges
                .filter((edge) => edge.live)
                .map((edge, index) => (
                  <circle key={edge.id} r={3} className="fill-live" opacity={0}>
                    <animateMotion dur="2.6s" begin={`${index * 0.7}s`} repeatCount="indefinite" path={edge.d} />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      keyTimes="0;0.15;0.85;1"
                      dur="2.6s"
                      begin={`${index * 0.7}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                ))}
          </svg>
        )}

        <Hub status={status} style={wide ? { left: hub.x, top: hub.y, width: HUB_WIDTH } : undefined} wide={wide} />

        <div className={cn(!wide && "flex flex-wrap justify-center gap-2")}>
          {nodes.map((node) => (
            <Pill key={node.id} node={node} style={wide ? { left: point(node).x, top: point(node).y } : undefined} />
          ))}
        </div>

        <p
          className={cn(
            "flex items-center gap-3 text-xs text-muted-foreground",
            wide ? "absolute bottom-3 left-4" : "justify-center",
          )}
        >
          <span className="tabular-nums">
            {connected} of {counted.length} connected
          </span>
          <span className="flex items-center gap-1.5">
            <svg aria-hidden width="18" height="2" className="overflow-visible">
              <line x1="0" y1="1" x2="18" y2="1" strokeWidth={1.5} strokeLinecap="round" className="stroke-live [stroke-dasharray:1_5]" />
            </svg>
            Connected
          </span>
          <span className="flex items-center gap-1.5">
            <svg aria-hidden width="18" height="2" className="overflow-visible">
              <line
                x1="0"
                y1="1"
                x2="18"
                y2="1"
                strokeWidth={1.5}
                strokeLinecap="round"
                className="stroke-muted-foreground/40 [stroke-dasharray:1_5]"
              />
            </svg>
            Not set up
          </span>
        </p>
      </div>
    </section>
  );
}

function Hub({ status, style, wide }: { status: ServiceStatus; style?: React.CSSProperties; wide: boolean }) {
  const live = status.mode === "live";
  return (
    <div
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card p-3 shadow-raised",
        wide && "absolute -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Mark />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">Mission Control</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {live ? (
            <span aria-hidden className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-success motion-safe:animate-live-pulse" />
              <span className="relative size-1.5 rounded-full bg-success" />
            </span>
          ) : (
            <IconFlask aria-hidden className="size-3.5" />
          )}
          {live ? "Live missions" : "Simulated missions"}
        </span>
      </span>
    </div>
  );
}

function Pill({ node, style }: { node: MapNode; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "flex h-11 items-center gap-2 rounded-full bg-card py-1 pr-3.5 pl-1.5 shadow-raised",
        style && "absolute -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <span className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-muted px-2">{node.marks}</span>
      <span className="flex flex-col">
        <span className="text-xs font-medium whitespace-nowrap text-foreground">{node.label}</span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">{node.sub}</span>
      </span>
      <span
        aria-label={node.live ? "Connected" : "Not set up"}
        role="img"
        className={cn("ml-1 size-1.5 shrink-0 rounded-full", node.live ? "bg-success" : "ring-1 ring-muted-foreground/60")}
      />
    </div>
  );
}
