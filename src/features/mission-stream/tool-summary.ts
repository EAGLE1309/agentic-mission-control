import type { ToolName } from "@/shared/events";

const MAIN_KEY: Record<ToolName, string> = { web_search: "query", fetch_url: "url", write_section: "title" };

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
    return tool === "web_search" ? `“${text}”` : text;
  }
  return inputPreview.replace(/\s+/g, " ").trim();
}
