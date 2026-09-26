import { seededRandom, sleep } from "../random";
import type { AppSlug, UsableApp } from "../../../src/shared/apps";
import type { AppSearchInput, AppWriteInput, FetchUrlInput, ToolOutcome, ToolRunContext, WebSearchInput } from "./registry";

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

// Simulated app tools. The links look like the app, with made-up IDs, so the
// demo shows favicons without any real data.

const APP_KINDS: Partial<Record<AppSlug, readonly string[]>> = {
  notion: ["Meeting notes", "Project brief", "Research log"],
  slack: ["Thread in #product", "Thread in #research", "Message in #general"],
  gmail: ["Email from a customer", "Email thread with the team", "Newsletter"],
  github: ["Issue", "Pull request", "Discussion"],
  linear: ["Issue", "Project update", "Bug"],
  jira: ["Story", "Bug", "Epic"],
};

function hex(rng: ReturnType<typeof seededRandom>, length: number): string {
  return Array.from({ length }, () => "0123456789abcdef"[rng.int(0, 15)]).join("");
}

function simulatedUrl(app: AppSlug, base: string, index: number, rng: ReturnType<typeof seededRandom>): string {
  switch (app) {
    case "notion":
      return `https://www.notion.so/${base}-${hex(rng, 32)}`;
    case "slack":
      return `https://app.slack.com/client/T0DEMO/C0DEMO${index}`;
    case "gmail":
      return `https://mail.google.com/mail/u/0/#all/${hex(rng, 16)}`;
    case "googledrive":
      return `https://drive.google.com/file/d/${hex(rng, 28)}/view`;
    case "googledocs":
      return `https://docs.google.com/document/d/${hex(rng, 28)}/edit`;
    case "dropbox":
      return `https://www.dropbox.com/home/${base}-${index + 1}`;
    case "github":
      return `https://github.com/acme/${base}/issues/${rng.int(10, 400)}`;
    case "linear":
      return `https://linear.app/acme/issue/ACM-${rng.int(10, 400)}`;
    case "jira":
      return `https://acme.atlassian.net/browse/ACM-${rng.int(10, 400)}`;
    case "googlecalendar":
      return `https://calendar.google.com/calendar/event?eid=${hex(rng, 20)}`;
    case "hubspot":
      return `https://app.hubspot.com/contacts/0/company/${rng.int(1000, 9999)}`;
    default:
      return `https://example.com/${app}/${base}-${index + 1}`;
  }
}

export async function runSimulatedAppTool(
  name: "app_search" | "app_write",
  input: AppSearchInput | AppWriteInput,
  context: ToolRunContext,
  app: UsableApp,
): Promise<ToolOutcome> {
  const rng = seededRandom(`${context.seed}:${JSON.stringify(input)}`);
  await sleep(rng.int(500, 1200));
  if (name === "app_search") {
    const { query } = input as AppSearchInput;
    const base = slug(query);
    const kinds = APP_KINDS[app.slug] ?? ["Document", "Note", "Update"];
    const lines = Array.from({ length: 3 }, (_, index) => {
      const title = `${titleCase(query.slice(0, 50))}: ${kinds[index % kinds.length]}`;
      const url = simulatedUrl(app.slug, base, index, rng);
      return `${index + 1}. ${title}\n   URL: ${url}\n   Notes from the team about ${query.toLowerCase()}, with dates and owners.`;
    });
    const text = `${app.name} results for "${query}" (3):\n${lines.join("\n")}`;
    return { ok: true, output: text, fullText: text };
  }
  const { title } = input as AppWriteInput;
  const url = simulatedUrl(app.slug, slug(title), 0, rng);
  const text = `Title: ${title}\nURL: ${url}\n\nCreated a ${app.slug === "gmail" ? "draft" : "item"} in ${app.name}: ${title}`;
  return { ok: true, output: text, fullText: text };
}
