import { seededRandom, sleep } from "../random";
import type { FetchUrlInput, ToolOutcome, ToolRunContext, WebSearchInput } from "./registry";

// Simulated web tools. Results use example.com, so nobody mistakes them for
// real sources.

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "page"
  );
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const KINDS = ["Guide", "Comparison", "Report", "Case study", "Overview", "Benchmark"] as const;

export async function runSimulatedTool(
  name: "web_search" | "fetch_url",
  input: WebSearchInput | FetchUrlInput,
  context: ToolRunContext,
): Promise<ToolOutcome> {
  const rng = seededRandom(`${context.seed}:${JSON.stringify(input)}`);

  if (name === "web_search") {
    const { query } = input as WebSearchInput;
    await sleep(rng.int(400, 1100));
    if (rng.chance(0.08)) {
      const error = "The search service did not respond in time.";
      return { ok: false, output: `Error: ${error}`, fullText: "", error };
    }
    const base = slug(query);
    const results = Array.from({ length: 4 }, (_, index) => {
      const kind = rng.pick(KINDS);
      return {
        title: `${titleCase(query.slice(0, 60))}: ${kind}`,
        url: `https://example.com/${base}/${slug(kind)}-${index + 1}`,
        snippet: `A ${kind.toLowerCase()} about ${query.toLowerCase()}, with notes on setup, cost, and common problems.`,
      };
    });
    const output = results
      .map((result, index) => `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}`)
      .join("\n");
    return { ok: true, output, fullText: output };
  }

  const { url, focus } = input as FetchUrlInput;
  await sleep(rng.int(600, 1500));
  if (rng.chance(0.06)) {
    const error = "The page did not load (HTTP 503).";
    return { ok: false, output: `Error: ${error}`, fullText: "", error };
  }
  const topic = focus || context.focusFallback;
  const title = titleCase(new URL(url).pathname.split("/").filter(Boolean).at(-1)?.replace(/-\d+$/, "").replace(/-/g, " ") ?? "Page");
  const paragraphs = [
    `${titleCase(topic)} depends on the use case. Small teams usually start with a managed option, and they move to a self-hosted setup when usage grows.`,
    `The main differences are setup effort, the quality of the documentation, and the cost at scale. Prices change often, so the numbers on this page are examples.`,
    `Several teams report that a pilot of two to four weeks gave them enough data to decide. They measured latency, cost for each request, and the time to fix problems.`,
    `Common problems: limits that are not clear, slow support on free plans, and migration work when a team changes providers.`,
  ];
  const fullText = `Title: ${title}\nURL: ${url}\n\n${paragraphs.join("\n\n")}`;
  return { ok: true, output: fullText, fullText };
}
