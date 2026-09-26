# Mission Control

Give AI agents a goal and watch them work. An orchestrator splits the goal into tasks, researcher and writer agents run them in parallel with web tools, and an assembler writes a report with sources. The run view shows everything live: a graph whose edges carry the work, a stream of the plan and tool calls, and the full trace of each task.

- **Web:** Next.js (App Router, `proxy.ts`), React, shadcn/ui on Base UI, Tailwind, React Flow + dagre, Motion.
- **Backend:** Convex (database, reactive queries, Workflow and Rate Limiter components), Better Auth.
- **Models and tools:** free OpenRouter models through the AI SDK, web search through Linkup, Exa, and Tavily, Jina Reader with a guarded direct fetch.

The product spec is in [`docs/prd.md`](docs/prd.md), the architecture in [`docs/tech-spec.md`](docs/tech-spec.md), the design system in [`docs/design.md`](docs/design.md), and the build plans in [`docs/superpowers/plans`](docs/superpowers/plans).

## Run it

1. Install the packages: `npm install`.
2. Start Convex in its own terminal: `npx convex dev`. The first run creates a deployment and writes `.env.local`.
3. Set the Convex environment (see below): `npx convex env set NAME value`.
4. Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `.env.local`.
5. Start the web app: `npm run dev`, then open http://localhost:3000.

With no OpenRouter key, missions run in **simulated mode**: scripted agents with realistic delays and no model or search calls. Set the keys to run live missions.

To deploy to Vercel and Convex Cloud, follow [`docs/deploy.md`](docs/deploy.md).

## Environment

Convex (`npx convex env set`):

| Name | Needed | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Session signing. Use 32 random bytes in base64. |
| `SITE_URL` | Yes | The web app URL, for example `http://localhost:3000`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | No | GitHub sign-in. Callback: `{SITE_URL}/api/auth/callback/github`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Google sign-in. Callback: `{SITE_URL}/api/auth/callback/google`. |
| `OPENROUTER_API_KEY` | Live mode | Model calls. |
| `OPENROUTER_DAILY_CAP` | No | Daily request cap of the account. Default 1000. |
| `OPENROUTER_MODELS` | No | Model chain for every agent, comma-separated. Example: `openrouter/free`. Replaces the presets in `src/shared/models.ts`. |
| `OPENROUTER_MODELS_ORCHESTRATOR`, `_RESEARCHER`, `_WRITER`, `_LIBRARIAN`, `_ASSEMBLER` | No | Model chain for one agent. Wins over `OPENROUTER_MODELS`. |
| `LINKUP_API_KEY` | Live mode, one search key or more | `web_search`, tried first. Free plan: about 4,000 searches each month. Sign up with a work email. |
| `EXA_API_KEY` | Live mode, one search key or more | `web_search`, tried second. Free plan: $10 of searches each month. |
| `TAVILY_API_KEY` | Live mode, one search key or more | `web_search`, tried last. Free plan: 1,000 searches each month. Without any search key, agents use `fetch_url` only. |
| `LINKUP_DAILY_CAP`, `EXA_DAILY_CAP`, `TAVILY_DAILY_CAP` | No | Searches each day for all users, per service. Defaults 130, 25, and 30 (the free plans). |
| `JINA_API_KEY` | No | Higher Jina Reader limits. |
| `LLM_MODE` | No | `simulated` or `live`. Default: live when an OpenRouter key is set. |
| `MISSION_QUOTA` | No | Missions for each user each day. Default 3. `off` removes the limit (development). |
| `COMPOSIO_API_KEY` | No | Connect third-party apps on the Integrations page through [Composio](https://composio.dev). The Librarian agent searches apps with Read on, and creates items in apps with Write on. |

A sign-in button shows only when its provider has keys.

Next.js (`.env.local`): `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Web app in development. |
| `npx convex dev` | Convex functions, with codegen on each save. |
| `npm test` | Backend tests (convex-test): auth scope, seq order, quotas, lists, tool guards. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |

## Notes

- Model chains are in [`src/shared/models.ts`](src/shared/models.ts). `BLOCKED_MODELS` lists models that are never used, not even from env. A daily cron refreshes the free model catalog and skips preset models that are gone. A chain set by env is used as given. The Agents page shows the chains in use.
- The landing demo plays [`fixtures/missions/landing.json`](fixtures/missions/landing.json), an event log recorded from a mission. To record a new one, run a mission, export its events with `events:page`, and replace the file.
