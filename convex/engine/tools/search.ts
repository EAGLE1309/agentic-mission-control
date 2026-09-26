import { SEARCH_ORDER, SEARCH_RESULTS, SEARCH_SNIPPET_CHARS, SEARCH_TIMEOUT_MS } from "../../../src/shared/constants";

// Web search services (tech spec §7.5). web_search tries the services that
// are set up in SEARCH_ORDER. A service that is out of searches or fails
// passes the query to the next one. All three have a free plan without a card.

export type SearchService = (typeof SEARCH_ORDER)[number];
export type SearchHit = { title: string; url: string; snippet: string };
export type SearchAttempt = { ok: true; hits: SearchHit[] } | { ok: false; error: string };
export type SearchResult = { ok: true; service: SearchService; hits: SearchHit[] } | { ok: false; error: string };

type ServiceSpec = {
  name: string;
  env: string;
  url: string;
  headers: (key: string) => Record<string, string>;
  body: (query: string) => unknown;
};

export const SEARCH_SERVICES: Record<SearchService, ServiceSpec> = {
  linkup: {
    name: "Linkup",
    env: "LINKUP_API_KEY",
    url: "https://api.linkup.so/v1/search",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: (query) => ({ q: query, depth: "standard", outputType: "searchResults", maxResults: SEARCH_RESULTS }),
  },
  exa: {
    name: "Exa",
    env: "EXA_API_KEY",
    url: "https://api.exa.ai/search",
    headers: (key) => ({ "x-api-key": key }),
    body: (query) => ({
      query,
      type: "fast",
      numResults: SEARCH_RESULTS,
      contents: { highlights: { maxCharacters: SEARCH_SNIPPET_CHARS } },
    }),
  },
  tavily: {
    name: "Tavily",
    env: "TAVILY_API_KEY",
    url: "https://api.tavily.com/search",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: (query) => ({ query, max_results: SEARCH_RESULTS, search_depth: "basic", include_answer: false }),
  },
};

const NO_SEARCH = "Use fetch_url with a URL you know.";

/** The search services that have a key, in SEARCH_ORDER. */
export function configuredServices(env: Record<string, string | undefined>): { service: SearchService; key: string }[] {
  return SEARCH_ORDER.flatMap((service) => {
    const key = env[SEARCH_SERVICES[service].env]?.trim();
    return key ? [{ service, key }] : [];
  });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** The hits in the answer of a service, or null when the answer has an unknown shape. */
export function parseHits(service: SearchService, body: unknown): SearchHit[] | null {
  const results = typeof body === "object" && body !== null ? (body as { results?: unknown }).results : undefined;
  if (!Array.isArray(results)) return null;
  const hits: SearchHit[] = [];
  for (const raw of results) {
    if (hits.length === SEARCH_RESULTS) break;
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.url !== "string" || !/^https?:\/\//i.test(entry.url) || entry.type === "image") continue;
    const title = clean(service === "linkup" ? entry.name : entry.title) || entry.url;
    const snippet =
      service === "exa"
        ? Array.isArray(entry.highlights)
          ? entry.highlights.map(clean).filter(Boolean).join(" … ")
          : clean(entry.text)
        : clean(entry.content);
    hits.push({ title, url: entry.url, snippet: snippet.slice(0, SEARCH_SNIPPET_CHARS) });
  }
  return hits;
}

/** Numbered hits with their links. The worker reads the sources from these lines. */
export function formatHits(hits: SearchHit[]): string {
  return hits.map((hit, index) => `${index + 1}. ${hit.title}\n   URL: ${hit.url}\n   ${hit.snippet}`).join("\n");
}

/** One search on one service. It never throws. */
export async function callService(service: SearchService, key: string, query: string): Promise<SearchAttempt> {
  const spec = SEARCH_SERVICES[service];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(spec.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...spec.headers(key) },
      body: JSON.stringify(spec.body(query)),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, error: `returned HTTP ${response.status}` };
    const hits = parseHits(service, await response.json().catch(() => null));
    return hits ? { ok: true, hits } : { ok: false, error: "returned an unknown answer" };
  } catch {
    return { ok: false, error: controller.signal.aborted ? "did not answer in time" : "could not be reached" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the query on the first service with searches left. `take` takes one
 * search from the daily cap of a service. An empty result does not move on.
 */
export async function searchInOrder(
  services: { service: SearchService; key: string }[],
  query: string,
  deps: {
    take: (service: SearchService) => Promise<boolean>;
    call: (service: SearchService, key: string, query: string) => Promise<SearchAttempt>;
  },
): Promise<SearchResult> {
  if (services.length === 0) return { ok: false, error: `Search is not set up. ${NO_SEARCH}` };
  const errors: string[] = [];
  for (const { service, key } of services) {
    if (!(await deps.take(service))) continue;
    const attempt = await deps.call(service, key, query);
    if (attempt.ok) return { ok: true, service, hits: attempt.hits };
    errors.push(`${SEARCH_SERVICES[service].name} ${attempt.error}`);
  }
  if (errors.length === 0) return { ok: false, error: `The daily search limit is reached. ${NO_SEARCH}` };
  return { ok: false, error: `Search failed: ${errors.join("; ")}. ${NO_SEARCH}` };
}
