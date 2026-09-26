import type { api } from "@convex/_generated/api";
import { IconCheck, IconFlask, IconAlertTriangle, type Icon } from "@tabler/icons-react";
import type { FunctionReturnType } from "convex/server";
import { SEARCH_ORDER } from "@/shared/constants";
import type { ToolName } from "@/shared/events";

// The Integrations page (FR-29, design §6.8): the built-in tools, the services
// that the agents use, and the third-party apps. Copy is for users.

export type ServiceStatus = FunctionReturnType<typeof api.integrations.status>;

export type State = "connected" | "ready" | "free" | "simulated" | "off" | "needs" | "needsApp" | "writeOff" | "via";

export const STATE_BADGE: Record<State, { label: string; variant: "success" | "neutral" | "warning"; icon?: Icon }> = {
  connected: { label: "Connected", variant: "success", icon: IconCheck },
  ready: { label: "Ready", variant: "success", icon: IconCheck },
  free: { label: "Free tier", variant: "neutral" },
  simulated: { label: "Simulated", variant: "neutral", icon: IconFlask },
  off: { label: "Not set up", variant: "neutral" },
  needs: { label: "Needs a search key", variant: "warning", icon: IconAlertTriangle },
  needsApp: { label: "Needs an app", variant: "warning", icon: IconAlertTriangle },
  writeOff: { label: "Off", variant: "neutral" },
  via: { label: "Via OpenRouter", variant: "neutral" },
};

/** A state that counts as working, for the Connected filter and the hero. */
export function isLive(state: State): boolean {
  return state === "connected" || state === "ready" || state === "free";
}

export type ServiceId = "openrouter" | (typeof SEARCH_ORDER)[number] | "jina" | "github" | "google";

export type Service = {
  id: ServiceId;
  /** A BrandMark key. */
  brand: string;
  name: string;
  section: "models" | "web" | "signin";
  blurb: string;
  /** What happens without it. */
  note?: string;
  /** What an admin sets in the Convex environment. */
  env: string[];
  state: (status: ServiceStatus) => State;
};

export const SERVICES: readonly Service[] = [
  {
    id: "openrouter",
    brand: "openrouter",
    name: "OpenRouter",
    section: "models",
    blurb: "Sends each agent's requests to a free model.",
    note: "Until you add a key, missions run with simulated agents.",
    env: ["OPENROUTER_API_KEY"],
    state: (status) => (status.openrouter ? (status.mode === "live" ? "connected" : "simulated") : "off"),
  },
  {
    id: "linkup",
    brand: "linkup",
    name: "Linkup",
    section: "web",
    blurb: "Runs Web search first.",
    note: "Free: about 4,000 searches each month. Sign up with a work email.",
    env: ["LINKUP_API_KEY"],
    state: (status) => (status.linkup ? "connected" : "off"),
  },
  {
    id: "exa",
    brand: "exa",
    name: "Exa",
    section: "web",
    blurb: "Runs Web search when Linkup is out or down.",
    note: "Free: $10 of searches each month.",
    env: ["EXA_API_KEY"],
    state: (status) => (status.exa ? "connected" : "off"),
  },
  {
    id: "tavily",
    brand: "tavily",
    name: "Tavily",
    section: "web",
    blurb: "Runs Web search when Linkup and Exa are out or down.",
    note: "Free: 1,000 searches each month.",
    env: ["TAVILY_API_KEY"],
    state: (status) => (status.tavily ? "connected" : "off"),
  },
  {
    id: "jina",
    brand: "jina",
    name: "Jina Reader",
    section: "web",
    blurb: "Turns pages into clean text for Page reader.",
    note: "Works without a key, at lower limits.",
    env: ["JINA_API_KEY"],
    state: (status) => (status.jina ? "connected" : "free"),
  },
  {
    id: "github",
    brand: "github",
    name: "GitHub",
    section: "signin",
    blurb: "Sign in with a GitHub account.",
    env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    state: (status) => (status.github ? "connected" : "off"),
  },
  {
    id: "google",
    brand: "google",
    name: "Google",
    section: "signin",
    blurb: "Sign in with a Google account.",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    state: (status) => (status.google ? "connected" : "off"),
  },
];

export function service(id: ServiceId): Service {
  const found = SERVICES.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown service ${id}`);
  return found;
}

/** The search services that are set up, in the order that Web search tries them. */
export function searchServices(status: ServiceStatus): Service[] {
  return SEARCH_ORDER.filter((id) => status[id]).map(service);
}

type PoweredBy = { brand: string; name: string };

/** The tools in words for users. The model sees the text in src/shared/agents.ts. */
export const TOOL_UI: Record<ToolName, { title: string; blurb: string; poweredBy?: PoweredBy }> = {
  web_search: {
    title: "Web search",
    blurb: "Searches the web and returns the top results with their links.",
  },
  fetch_url: {
    title: "Page reader",
    blurb: "Opens one page and keeps only the parts the task needs.",
    poweredBy: { brand: "jina", name: "Jina Reader" },
  },
  app_search: {
    title: "App search",
    blurb: "Searches the apps you connect: pages, messages, email, issues, and files.",
    poweredBy: { brand: "composio", name: "Composio" },
  },
  app_write: {
    title: "App write",
    blurb: "Creates a page, doc, issue, message, or email draft where you allow it. It never edits or deletes.",
    poweredBy: { brand: "composio", name: "Composio" },
  },
  write_section: {
    title: "Section writer",
    blurb: "Hands in the finished section and its sources. This ends the task.",
  },
};

/** The services behind a tool. Web search shows the search services that are set up, or all of them. */
export function poweredBy(tool: ToolName, status: ServiceStatus): PoweredBy[] {
  if (tool !== "web_search") return TOOL_UI[tool].poweredBy ? [TOOL_UI[tool].poweredBy] : [];
  const set = searchServices(status);
  return (set.length > 0 ? set : SEARCH_ORDER.map(service)).map((item) => ({ brand: item.brand, name: item.name }));
}

/** Connected apps that agents may search (read) and create in (write). */
export type AppCounts = { read: number; write: number };

export function toolState(tool: ToolName, status: ServiceStatus, apps: AppCounts): State {
  if (tool === "write_section") return "ready";
  if (tool === "app_search" && apps.read === 0) return "needsApp";
  if (tool === "app_write" && apps.write === 0) return "writeOff";
  if (status.mode === "simulated") return "simulated";
  if (tool === "web_search") return searchServices(status).length > 0 ? "ready" : "needs";
  return "ready";
}
