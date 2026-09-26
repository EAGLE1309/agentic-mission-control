import type { AppSlug } from "../../../src/shared/apps";
import type { Source } from "../../../src/shared/events";

// The Composio actions of the librarian (tech spec §7.5). Each app has at most
// one search action (tagged readOnlyHint in Composio) and one create action
// (tagged createHint, never updateHint or destructiveHint). Slugs were checked
// against the Composio catalog on 2026-09-26. The app list in
// src/shared/apps.ts must match: a test checks it.

type Args = Record<string, unknown>;
type Built = { ok: true; args: Args } | { ok: false; error: string };

export type WriteInput = { title: string; content: string; target?: string };

/** Google Drive query text inside single quotes. */
function driveQuote(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * `browse` lists what the app shares with Mission Control, newest first. The
 * engine uses it when a search finds nothing, and to pick a Notion parent page.
 */
export const SEARCH_ACTIONS: Partial<Record<AppSlug, { slug: string; args: (query: string) => Args; browse?: Args }>> = {
  notion: {
    slug: "NOTION_SEARCH_NOTION_PAGE",
    args: (query) => ({ query, page_size: 10 }),
    browse: { query: "", page_size: 10, timestamp: "last_edited_time", direction: "descending" },
  },
  slack: { slug: "SLACK_SEARCH_MESSAGES", args: (query) => ({ query, count: 10 }) },
  gmail: { slug: "GMAIL_FETCH_EMAILS", args: (query) => ({ query, max_results: 8 }) },
  googledrive: {
    slug: "GOOGLEDRIVE_FIND_FILE",
    args: (query) => ({
      q: `fullText contains '${driveQuote(query)}' and trashed = false`,
      pageSize: 10,
      fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
    }),
  },
  googledocs: { slug: "GOOGLEDOCS_SEARCH_DOCUMENTS", args: (query) => ({ query, max_results: 10 }) },
  dropbox: { slug: "DROPBOX_FILES_SEARCH", args: (query) => ({ query, max_results: 10 }) },
  github: { slug: "GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS", args: (query) => ({ q: query, per_page: 10 }) },
  linear: { slug: "LINEAR_SEARCH_ISSUES", args: (query) => ({ query, first: 10 }) },
  jira: { slug: "JIRA_SEARCH_ISSUES", args: (query) => ({ text_search: query, max_results: 10 }) },
  googlecalendar: { slug: "GOOGLECALENDAR_FIND_EVENT", args: (query) => ({ query, max_results: 10 }) },
  hubspot: { slug: "HUBSPOT_SEARCH_COMPANIES", args: (query) => ({ query, limit: 10 }) },
};

export const WRITE_ACTIONS: Partial<Record<AppSlug, { slug: string; args: (input: WriteInput) => Built }>> = {
  notion: {
    // appTools turns the target into a page ID first, or picks a parent page.
    slug: "NOTION_CREATE_NOTION_PAGE",
    args: ({ title, content, target }) =>
      target
        ? { ok: true, args: { title, markdown: content, parent_id: target } }
        : { ok: false, error: "Notion needs a parent page." },
  },
  googledocs: {
    slug: "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN",
    args: ({ title, content }) => ({ ok: true, args: { title, markdown_text: content } }),
  },
  gmail: {
    // A draft only. The librarian never sends email.
    slug: "GMAIL_CREATE_EMAIL_DRAFT",
    args: ({ title, content, target }) => ({
      ok: true,
      args: { subject: title, body: content, ...(target ? { recipient_email: target } : {}) },
    }),
  },
  slack: {
    slug: "SLACK_SEND_MESSAGE",
    args: ({ title, content, target }) =>
      target
        ? { ok: true, args: { channel: target, markdown_text: `*${title}*\n\n${content}` } }
        : { ok: false, error: "Slack needs a target: the channel, for example #general." },
  },
  github: {
    slug: "GITHUB_CREATE_AN_ISSUE",
    args: ({ title, content, target }) => {
      const match = /^([\w.-]+)\/([\w.-]+)$/.exec(target ?? "");
      return match
        ? { ok: true, args: { owner: match[1], repo: match[2], title, body: content } }
        : { ok: false, error: "GitHub needs a target: the repository as owner/repo." };
    },
  },
};

/** The page ID in a Notion ID or link, or null when the text is a title. */
export function notionPageId(target: string): string | null {
  const text = target.trim().toLowerCase();
  const dashed = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/.exec(text);
  if (dashed) return dashed[1];
  const plain = /(?:^|[^0-9a-f])([0-9a-f]{32})(?:$|[^0-9a-f])/.exec(text);
  return plain ? plain[1] : null;
}

// Result text. The shapes differ for each app, so a generic reader finds the
// items: objects with a link, a title, and some text.

const URL_KEYS = ["url", "html_url", "permalink", "webViewLink", "htmlLink", "web_url", "link", "document_url", "documentUrl"];
const TITLE_KEYS = ["title", "name", "subject", "summary", "plain_text", "displayName"];
const TEXT_KEYS = ["snippet", "preview", "messageText", "text", "description", "body", "content"];
const MAX_ITEMS = 10;

export type Item = { title: string; url: string | null; id: string | null; text: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringAt(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** A title may sit deeper, for example Notion page properties. */
function deepTitle(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = deepTitle(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const direct = stringAt(value, TITLE_KEYS);
  if (direct) return direct;
  for (const key of ["properties", "title", "Name", "name"]) {
    if (key in value) {
      const found = deepTitle(value[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** A link for apps that give an ID but no URL. */
function fallbackUrl(app: AppSlug, record: Record<string, unknown>): string | null {
  const id = typeof record.id === "string" ? record.id : null;
  if (app === "gmail") {
    const thread = typeof record.threadId === "string" ? record.threadId : null;
    const message = typeof record.messageId === "string" ? record.messageId : null;
    return thread || message ? `https://mail.google.com/mail/u/0/#all/${thread ?? message}` : null;
  }
  if (app === "googledocs" && id) return `https://docs.google.com/document/d/${id}/edit`;
  if (app === "googledrive" && id) return `https://drive.google.com/file/d/${id}/view`;
  return null;
}

function collectItems(app: AppSlug, value: unknown, items: Item[], depth = 0): void {
  if (items.length >= MAX_ITEMS || depth > 6) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectItems(app, entry, items, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  const url = stringAt(value, URL_KEYS);
  const link = url && /^https?:\/\//i.test(url) ? url : fallbackUrl(app, value);
  const title = deepTitle(value);
  if (title && (link || typeof value.id === "string")) {
    const text = stringAt(value, TEXT_KEYS) ?? "";
    items.push({ title, url: link, id: typeof value.id === "string" ? value.id : null, text: text.replace(/\s+/g, " ").slice(0, 300) });
    return;
  }
  for (const entry of Object.values(value)) collectItems(app, entry, items, depth + 1);
}

/** The items in an app result: objects with a title and a link or ID. */
export function listItems(app: AppSlug, data: unknown): Item[] {
  const items: Item[] = [];
  collectItems(app, data, items);
  return items;
}

/** The model text and the sources of an app search result. `heading` replaces the first line. */
export function formatSearch(
  app: AppSlug,
  appName: string,
  query: string,
  data: unknown,
  heading?: string,
): { text: string; sources: Source[] } {
  const items = listItems(app, data);
  if (items.length === 0) {
    const raw = JSON.stringify(data ?? null);
    const empty = raw === "null" || raw === "[]" || raw === "{}" || /"results?":\s*\[\]/.test(raw) || /"(messages|files|items|issues)":\s*\[\]/.test(raw);
    return {
      text: empty ? `${appName} has no items for "${query}". Try other words.` : `${appName} results for "${query}":\n${raw.slice(0, 6_000)}`,
      sources: [],
    };
  }
  const lines = items.map((item, index) => {
    const parts = [`${index + 1}. ${item.title}`];
    if (item.url) parts.push(`   URL: ${item.url}`);
    if (item.id && app === "notion") parts.push(`   ID: ${item.id}`);
    if (item.text) parts.push(`   ${item.text}`);
    return parts.join("\n");
  });
  return {
    text: `${heading ?? `${appName} results for "${query}" (${items.length}):`}\n${lines.join("\n")}`,
    sources: items.filter((item) => item.url).map((item) => ({ title: item.title, url: item.url as string })),
  };
}

/** The model text and the source of a created item. */
export function formatCreated(app: AppSlug, appName: string, title: string, data: unknown): { text: string; sources: Source[] } {
  const items: Item[] = [];
  collectItems(app, isRecord(data) ? { ...data, title: stringAt(data, TITLE_KEYS) ?? title } : data, items);
  const url = items.find((item) => item.url)?.url ?? null;
  const id = items[0]?.id ?? (isRecord(data) && typeof data.id === "string" ? data.id : null);
  const kind = app === "gmail" ? "draft" : "item";
  const lines = [`Created a ${kind} in ${appName}: ${title}`];
  if (url) lines.push(`URL: ${url}`);
  if (id) lines.push(`ID: ${id}`);
  return { text: `Title: ${title}\n${lines.slice(1).join("\n")}\n\n${lines[0]}`, sources: url ? [{ title, url }] : [] };
}
