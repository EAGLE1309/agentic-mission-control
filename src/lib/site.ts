// Site facts for metadata, robots, the sitemap, and structured data.

/**
 * The public origin, with no trailing slash (docs/deploy.md, "Site URL").
 * `NEXT_PUBLIC_SITE_URL` wins, for a custom domain. On Vercel, the production
 * domain is the fallback, so a deploy needs no extra setup.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Mission Control";

/** The landing title, also the title of shared links. */
export const SITE_TITLE = "Mission Control: AI research agents you can watch work";

export const SITE_DESCRIPTION =
  "Give AI agents a goal. An orchestrator splits it into tasks, agents research in parallel on a live graph, and you get a report with sources.";

export const SITE_AUTHOR = { name: "eagledev.in", url: "https://eagledev.in" };
