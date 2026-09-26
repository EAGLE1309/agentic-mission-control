// Report helpers for the engine and the report tab.

/**
 * The report without the Sources section that the engine adds. The engine
 * uses it before a revision. The report tab shows the sources as a styled list.
 */
export function stripSources(markdown: string): string {
  const index = markdown.lastIndexOf("\n## Sources\n");
  return index === -1 ? markdown : markdown.slice(0, index).trimEnd();
}

/** "example.com" for a source URL, or the URL when it does not parse. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
