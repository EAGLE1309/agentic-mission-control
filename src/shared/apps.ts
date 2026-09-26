// Third-party apps that a user can connect through Composio (design §6.8).
// The slug is the Composio toolkit slug. The blurb names what an agent can
// read there: agents do not change things outside the app (PRD §3).

export const APP_CATEGORIES = [
  { id: "communication", label: "Communication" },
  { id: "knowledge", label: "Docs and files" },
  { id: "code", label: "Code and issues" },
  { id: "planning", label: "Planning" },
  { id: "design", label: "Design and sales" },
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number]["id"];

/** What the librarian can create in an app, what "target" means there, and if a create fails without one. */
export type AppWrite = { creates: string; target?: string; needsTarget?: boolean };

export type AppSpec = {
  slug: string;
  name: string;
  category: AppCategory;
  blurb: string;
  /** The librarian can search it (a read-only Composio action exists). */
  search: boolean;
  /** The librarian can create items in it (a create-only Composio action exists). */
  write?: AppWrite;
  /** How search and create work in this app, for the librarian. */
  notes?: string;
};

export const APPS = [
  {
    slug: "slack",
    name: "Slack",
    category: "communication",
    blurb: "Channels and threads",
    search: true,
    write: { creates: "messages", target: "the channel, for example #general", needsTarget: true },
  },
  {
    slug: "gmail",
    name: "Gmail",
    category: "communication",
    blurb: "Email threads",
    search: true,
    write: { creates: "email drafts", target: "the recipient email address, optional" },
  },
  { slug: "discord", name: "Discord", category: "communication", blurb: "Server channels", search: false },
  {
    slug: "notion",
    name: "Notion",
    category: "knowledge",
    blurb: "Pages and databases",
    search: true,
    write: { creates: "pages", target: "the parent page: its ID, link, or title. Optional" },
    notes:
      "Search matches page titles only, not the text in pages. When no title matches, the result lists all the pages that Mission Control can see. A new page goes under a parent page. Without a target, it goes under the page edited most recently.",
  },
  { slug: "googledrive", name: "Google Drive", category: "knowledge", blurb: "Files and folders", search: true },
  { slug: "googledocs", name: "Google Docs", category: "knowledge", blurb: "Documents", search: true, write: { creates: "documents" } },
  { slug: "dropbox", name: "Dropbox", category: "knowledge", blurb: "Files and folders", search: true },
  {
    slug: "github",
    name: "GitHub",
    category: "code",
    blurb: "Repos, issues, and pull requests",
    search: true,
    write: { creates: "issues", target: "the repository, for example owner/repo", needsTarget: true },
  },
  { slug: "gitlab", name: "GitLab", category: "code", blurb: "Projects and merge requests", search: false },
  { slug: "linear", name: "Linear", category: "code", blurb: "Issues and projects", search: true },
  { slug: "jira", name: "Jira", category: "code", blurb: "Issues and boards", search: true },
  { slug: "googlecalendar", name: "Google Calendar", category: "planning", blurb: "Events and free time", search: true },
  { slug: "clickup", name: "ClickUp", category: "planning", blurb: "Tasks and lists", search: false },
  { slug: "asana", name: "Asana", category: "planning", blurb: "Tasks and projects", search: false },
  { slug: "airtable", name: "Airtable", category: "planning", blurb: "Bases and records", search: false },
  { slug: "figma", name: "Figma", category: "design", blurb: "Design files and comments", search: false },
  { slug: "hubspot", name: "HubSpot", category: "design", blurb: "Companies and deals", search: true },
] as const satisfies readonly AppSpec[];

export type AppSlug = (typeof APPS)[number]["slug"];

const SLUGS = new Set<string>(APPS.map((app) => app.slug));

export function isAppSlug(value: string): value is AppSlug {
  return SLUGS.has(value);
}

export function appSpec(slug: AppSlug): AppSpec {
  return APPS.find((app) => app.slug === slug) as AppSpec;
}

/** An app that the librarian may use in a mission: capability and the user's choice together. */
export type UsableApp = { slug: AppSlug; name: string; read: boolean; write: boolean };

/** The apps an agent may use, from the user's rows. Read is on and write is off until the user changes them. */
export function usableApps(rows: readonly { toolkit: string; read?: boolean; write?: boolean }[]): UsableApp[] {
  const apps: UsableApp[] = [];
  for (const row of rows) {
    if (!isAppSlug(row.toolkit)) continue;
    const spec = appSpec(row.toolkit);
    const read = spec.search && (row.read ?? true);
    const write = spec.write !== undefined && (row.write ?? false);
    if (read || write) apps.push({ slug: row.toolkit, name: spec.name, read, write });
  }
  return apps;
}
