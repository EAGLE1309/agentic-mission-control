import { APPS, isAppSlug, type AppSlug } from "@/shared/apps";
import type { ToolName } from "@/shared/events";

const MAIN_KEY: Record<ToolName, string> = {
  web_search: "query",
  fetch_url: "url",
  write_section: "title",
  app_search: "query",
  app_write: "title",
};

const APP_NAME = new Map<string, string>(APPS.map((app) => [app.slug, app.name]));

/** One string field of a tool input. Previews can be cut, so a pattern reads it when the JSON does not parse. */
export function toolInputField(inputPreview: string, key: string): string | null {
  let value: unknown;
  try {
    value = (JSON.parse(inputPreview) as Record<string, unknown>)[key];
  } catch {
    value = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(inputPreview)?.[1];
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The app of an app_search or app_write input, for its mark. */
export function toolInputApp(tool: ToolName, inputPreview: string): string | null {
  if (tool !== "app_search" && tool !== "app_write") return null;
  return toolInputField(inputPreview, "app");
}

/** The app of an app tool call when it is a known app, for its mark. */
export function toolCallApp(tool: ToolName, inputPreview: string): AppSlug | null {
  const app = toolInputApp(tool, inputPreview);
  return app && isAppSlug(app) ? app : null;
}

/**
 * The main argument of a tool call for one-line rows: the query, the URL, or
 * the section title. Previews can be cut, so the JSON may not parse; then a
 * pattern finds the argument, and at last the raw text shows.
 */
export function toolInputSummary(tool: ToolName, inputPreview: string): string {
  const key = MAIN_KEY[tool];
  let value: unknown;
  try {
    value = (JSON.parse(inputPreview) as Record<string, unknown>)[key];
  } catch {
    value = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(inputPreview)?.[1];
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const app = toolInputApp(tool, inputPreview);
    const appName = app ? (APP_NAME.get(app) ?? app) : null;
    if (tool === "app_search") return `${appName ? `${appName} · ` : ""}“${text}”`;
    if (tool === "app_write") return `${appName ? `${appName} · ` : ""}${text}`;
    return tool === "web_search" ? `“${text}”` : text;
  }
  return inputPreview.replace(/\s+/g, " ").trim();
}
