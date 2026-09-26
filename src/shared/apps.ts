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

export type AppSpec = { slug: string; name: string; category: AppCategory; blurb: string };

export const APPS = [
  { slug: "slack", name: "Slack", category: "communication", blurb: "Channels and threads" },
  { slug: "gmail", name: "Gmail", category: "communication", blurb: "Email threads" },
  { slug: "discord", name: "Discord", category: "communication", blurb: "Server channels" },
  { slug: "notion", name: "Notion", category: "knowledge", blurb: "Pages and databases" },
  { slug: "googledrive", name: "Google Drive", category: "knowledge", blurb: "Files and folders" },
  { slug: "googledocs", name: "Google Docs", category: "knowledge", blurb: "Documents" },
  { slug: "dropbox", name: "Dropbox", category: "knowledge", blurb: "Files and folders" },
  { slug: "github", name: "GitHub", category: "code", blurb: "Repos, issues, and pull requests" },
  { slug: "gitlab", name: "GitLab", category: "code", blurb: "Projects and merge requests" },
  { slug: "linear", name: "Linear", category: "code", blurb: "Issues and projects" },
  { slug: "jira", name: "Jira", category: "code", blurb: "Issues and boards" },
  { slug: "googlecalendar", name: "Google Calendar", category: "planning", blurb: "Events and free time" },
  { slug: "clickup", name: "ClickUp", category: "planning", blurb: "Tasks and lists" },
  { slug: "asana", name: "Asana", category: "planning", blurb: "Tasks and projects" },
  { slug: "airtable", name: "Airtable", category: "planning", blurb: "Bases and records" },
  { slug: "figma", name: "Figma", category: "design", blurb: "Design files and comments" },
  { slug: "hubspot", name: "HubSpot", category: "design", blurb: "Contacts, companies, and deals" },
] as const satisfies readonly AppSpec[];

export type AppSlug = (typeof APPS)[number]["slug"];

const SLUGS = new Set<string>(APPS.map((app) => app.slug));

export function isAppSlug(value: string): value is AppSlug {
  return SLUGS.has(value);
}
