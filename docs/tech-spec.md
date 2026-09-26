# Mission Control — Technical Specification

**Date:** 2026-09-26 · **Related:** [`prd.md`](./prd.md) · "FR-x" is a requirement in the PRD.

## 1. Terms

Each term has one meaning in this document.

| Term | Meaning |
|---|---|
| Mission | One goal from a user, and all the work for that goal. |
| Plan | The tasks that the orchestrator makes for a mission. The tasks and their dependencies make a DAG. |
| Node | One unit of work in the graph: orchestrator, worker, critic, assembler, or revision. |
| Wave | All nodes that are ready at one time. The engine runs one wave in parallel. |
| Event | A record of one thing that occurred in a mission. Nobody changes an event after the engine writes it. |
| Reducer | A pure function. It changes a list of events into UI state. |
| Artifact | A large text: a prompt, a tool output, or a node output. Events refer to artifacts by ID. |
| Engine | The Convex workflow and actions that run a mission. |
| Chain | An ordered list of models for one role. If a model fails, the engine uses the next model. |
| Intent | A mutation that the browser sends: create, stop, revise, steer, or approve. |

## 2. Stack

| Area | Choice |
|---|---|
| Web | Next.js App Router (`proxy.ts`), React, TypeScript |
| UI | shadcn/ui (Base UI), Tailwind, Motion, lucide |
| Graph | React Flow, dagre layout |
| Backend | Convex: database, reactive queries, actions, scheduler |
| Long runs | Convex Workflow component |
| Limits | Convex Rate Limiter component |
| Auth | Better Auth, Convex integration |
| Models | OpenRouter free models, Vercel AI SDK |
| Tools | Linkup, Exa, and Tavily for search, in that order. Jina Reader for pages, with direct fetch as the fallback. |
| Retrieval | BM25 in memory for page chunks. Convex search index (BM25) for agent memory (v2). |
| Markdown | Streamdown, with raw HTML off |
| Client state | Zustand, one store for each run view |
| v2 only | Recharts, `@react-pdf/renderer`, Resend |
| Tests | Vitest, convex-test, Playwright |
| Hosting | Vercel, Convex Cloud |

We do not use LangChain. We do not use Langfuse in v1. Section 15 gives the reasons.

## 3. Architecture

```
Browser ── Convex WebSocket ──► queries: events tail, nodeLive, missions, artifacts
   │                           intents: create / stop / revise / steer / approve
   ▼
Convex: missions.create → missionWorkflow
        plan → waves of workers (parallel) → [critic v2] → assemble → finish
        each step = Node action → rate limiter → OpenRouter / search services / Jina
        actions call emit() → appendEvents (internal mutation)
Next server: RSC preload · /api/auth/[...all] → Better Auth on Convex · proxy.ts redirect
```

### 3.1 Rules

1. The event log is the source of truth. The reducer makes all mission UI from events. The live view, replay, share page, and landing demo use the same reducer.
2. The engine writes. The UI reads. The browser sends only intents. A mission continues when the user closes the tab.
3. Each model call and each tool call goes through the rate limiter. The engine writes an event before and after each call.
4. Each role gets its models from a chain in the configuration. To change a model, change only the configuration.
5. Events contain previews of 500 characters or less. Artifacts contain the full text. The UI loads artifacts only when necessary.

### 3.2 Why Convex

Convex reactive queries replace SSE. Convex handles reconnects and multiple tabs. Replay reads the same data as the live view. Durable workflows run missions that take many minutes, and they can pause for an approval. With PostgreSQL, we must add a job runner, a realtime layer, and a rate limiter.

## 4. Repository layout

```
convex/
  schema.ts  auth.ts  http.ts  convex.config.ts  crons.ts
  lib/auth.ts                      # requireUser
  missions.ts  events.ts  live.ts  artifacts.ts  deliverables.ts  inbox.ts  quotas.ts  catalog.ts
  engine/
    workflow.ts  state.ts  emit.ts
    plan.node.ts  worker.node.ts  assemble.node.ts  critic.node.ts  replan.node.ts
    llm/      client.ts  openrouter.ts  simulated.ts  models.ts  scripts/
    tools/    registry.ts  webSearch.ts  fetchUrl.ts  writeSection.ts
    prompts/
  approvals.ts  steers.ts  shares.ts  agents.ts  schedules.ts  usage.ts     # v2
src/
  proxy.ts
  shared/     events.ts  reducer.ts  plan.ts  layout.ts  templates.ts  constants.ts
  app/        (marketing)  (auth)  (app)/{home,missions,missions/[id],inbox,templates,tools,agents,usage,settings}
              api/auth/[...all]  r/[slug] (v2)
  features/   mission-graph  mission-stream  trace  composer  deliverable  replay  command-palette  shell
fixtures/missions/*.json           # recorded event logs for tests and the landing demo
```

- `src/shared/` contains code for both the app and Convex. Convex imports it with relative paths.
- A file with `"use node"` can contain only actions. Thus each engine action has its own `*.node.ts` file. The queries and mutations that these actions call are in other files.
- All tunable numbers are in `src/shared/constants.ts`.

## 5. Data model

App tables refer to Better Auth users by `userId`.

### 5.1 v1 tables

| Table | Contents |
|---|---|
| `missions` | One row for each mission. Fields: `userId`, `goal`, `title`, `status`, `partial`, `modelProfile`, `mode` (`live` or `simulated`), `workflowId`, `lastSeq`, `stopRequested`, `stats` (calls, tokens), `budget`, timestamps, `lastActivityAt`. Indexes: `by_user_created`, `by_status_activity`. Search index on `goal`. |
| `events` | The event log: `missionId`, `seq`, `at`, `type`, `nodeId?`, `payload`. Index: `by_mission_seq`. The engine only adds rows. It never changes or deletes them. |
| `nodes` | The engine copy of the plan state: `nodeId`, `role`, `title`, `instructions`, `dependsOn`, `status`, `attempt`, `outputArtifactId`. Only the engine reads this table. The UI uses the reducer. |
| `nodeLive` | The live thought text of each node. The worker updates it 4 times each second or less. It is not in the event log, so replay does not show it. |
| `artifacts` | Full texts: `prompt`, `tool_input`, `tool_output`, `node_output`. Maximum 200,000 characters each. |
| `deliverables` | `missionId`, `version`, `markdown`, `sources`, `instruction?`. |
| `inboxItems` | `userId`, `kind`, `missionId`, `readAt`. |
| `modelCatalog` | Free OpenRouter models, with tool support and structured-output support. A cron job updates it each day. |

**Mission status values:** `queued`, `planning`, `running`, `assembling`, `completed`, `failed`, `stopped`. v2 adds `awaiting_approval`.

**Node status values:** `pending`, `queued`, `running`, `done`, `failed`, `killed`. v2 adds `reviewing`.

### 5.2 v2 tables

`approvals`, `steers`, `agents`, `agentMemories`, `schedules`, `shares`, `usageDaily`. v2 also adds `agentId` and `killRequested` to `nodes`.

### 5.3 Event order

1. The internal mutation `appendEvents` gives each event a `seq` number. It starts at `mission.lastSeq + 1`.
2. In the same transaction, it updates the `nodes` table and the `missions` table.
3. Convex mutations are serializable. Thus the seq numbers have no gaps, also when workers run in parallel.
4. An action sends all events of one step in one `appendEvents` call.

## 6. Events

Each event has this envelope: `{ missionId, seq, at, type, nodeId?, payload }`. The schemas are in `src/shared/events.ts`.

### 6.1 v1 event types

| Type | Important payload fields |
|---|---|
| `mission_created` | `goal`, `modelProfile`, `mode` |
| `mission_status` | `status` |
| `plan_created` | `title`, `rationale`, `nodes[]` (`id`, `role`, `title`, `instructions`, `dependsOn`), `saveTo?` (`app`, `target?`) |
| `nodes_added` | `nodes[]`, `reason` (`revision`, `replan`, `user_branch`) |
| `nodes_reset` | `nodes[]` (`id`, `instructions?`): a follow-up runs these tasks again |
| `save_requested` | `app`, `target?`: a follow-up saves the report to an app |
| `node_queued` | `reason`, `retryAfterMs?` |
| `node_started` | `attempt`, `model` |
| `thought` | `step`, `text` (the text of one finished model step) |
| `tool_call` | `callId`, `tool`, `inputPreview`, `inputArtifactId` |
| `tool_result` | `callId`, `ok`, `outputPreview`, `outputArtifactId?`, `durationMs`, `error?`, `urls?` (up to 8 pages or app items the tool found, read, or created, for favicons) |
| `llm_usage` | `model`, `inputTokens`, `outputTokens`, `latencyMs` |
| `node_done` | `summary`, `outputArtifactId`, `sources[]` |
| `node_failed` | `error`, `retryable`, `attempt` |
| `deliverable_ready` | `version` |
| `revision_requested` | `instruction`, `nodeId` |
| `mission_completed` | `partial`, `stats`, `durationMs` |
| `mission_failed` | `error` |
| `mission_stopped` | `by` (`user` or `system`) |

### 6.2 v2 event types

`critic_reviewed`, `node_retrying`, `approval_requested`, `approval_resolved`, `user_steer`, `node_edited`, `node_killed`, `replanned`, `share_published`, `share_revoked`.

### 6.3 Graph rules

The reducer and `appendEvents` use the same rules from `src/shared/plan.ts`. Thus the UI and the `nodes` table always agree.

- **Reserved node IDs:** `orchestrator`, `assembler`, `critic`, `report`, `save`, `revision-{n}`. A plan must not use these IDs. Plan IDs must match `[a-z0-9-]{1,32}`.
- **Edges:**
  - orchestrator → each root worker
  - each dependency → the node that needs it
  - each leaf worker → assembler
  - report → save node (when the plan or a follow-up saves the report to an app)
  - report → each revision node (one for each follow-up turn)
- **Tool satellites:** The first call to a tool on a node makes a satellite node `${nodeId}:${tool}`. Tool calls and tool results move as packets on the satellite edge.
- **Critic (v2):** One critic node. Reviews move as packets from worker to critic. Verdicts move from critic to worker.

## 7. Engine

### 7.1 Mission lifecycle

1. **Create.** The mutation `missions.create` does these steps:
   1. Check the user and the goal.
   2. Check the global daily capacity.
   3. Use one mission from the daily quota of the user.
   4. Add the mission row. Start the workflow.

   If a step fails, Convex rolls back all steps, because one mutation is one transaction.
2. **Run.** `missionWorkflow` runs the mission. Workflow code must be deterministic. It does no direct IO. Steps send and return IDs only.
   1. Run `plan`.
   2. Do these steps again until no node is ready:
      - If `stopRequested` is true, stop.
      - (v2) Apply steers and gates.
      - Run all ready nodes in parallel. This is one wave.
   3. Run `assemble`.
   4. Run `finish`. It sets the final status and adds an Inbox item.
3. **Ready nodes.** A node is ready when it is `pending` and all its dependencies are `done`, `failed`, or `killed`. If a dependency failed, the node runs with a note about the missing input. The mission then ends as `partial`.
4. **Stop.** `missions.stop` sets `stopRequested` and cancels the workflow. Each running action checks this flag before each call. If the flag is true, the action stops.
5. **Save (FR-25).** A plan can set `saveTo`. After the assembler, the save step sends the exact report to that app with `app_write`. A failed save keeps the report and marks the mission partial.
6. **Follow-ups (FR-25).** After a mission completes, fails, or stops, the user writes in the chat. The maximum is 10 turns for each mission.
   - `missions.followUp` adds a `revision-{n}` node for the turn, adds 40 model calls to the budget, and starts `followUpWorkflow`.
   - The director (the orchestrator with `DIRECTOR_PROMPT`) reads the tasks with their status, errors, and outputs, the latest report, the saved copies, the apps, and the earlier turns. It returns a turn: `reply`, `rerun`, `add`, `report` (`keep`, `rewrite`, or `revise`), `reportInstruction`, and `saveTo`. The engine checks the turn and sends the errors back to the model, 2 times at most.
   - A rerun also runs each task that depends on a rerun task (`rerunClosure`). Tasks that run make the report `rewrite`.
   - The workflow then runs the waves, the assembler, and the save step. `closeTurn` gives the turn node a summary and completes the mission again.
   - A Rerun button sends task IDs. Then no model runs for the director.
   - The director and text edits do not use the budget. Tasks and rewrites do.

### 7.2 Models

- The `LlmClient` interface has two methods:
  - `step()` makes one model turn. It streams text deltas.
  - `object()` makes one structured output.
- There are two implementations: OpenRouter and simulated.
- Presets connect each role to a chain. v1 has two presets: `balanced` and `fast`.
- The client uses the next model in the chain when one of these occurs:
  - The provider sends an error.
  - A tool call is malformed after one repair.
  - The output does not match the schema after the retries.
- A cron job updates `modelCatalog` each day. The client skips a chain model that has not been in the catalog for 48 hours.
- Use `openrouter/free` only as the last model in the researcher chain. Its capabilities change from call to call.

### 7.3 Orchestrator

- The orchestrator makes a plan of 2–6 nodes. Each node has a role (`researcher` or `writer`) and a `dependsOn` list.
- The engine validates the plan as a DAG: unique IDs, no cycles, no reserved IDs, at least one root.
- If the plan is not valid:
  1. Send the errors to the model and ask again. Do this 2 times maximum.
  2. Use the next model in the chain.
  3. If the plan is still not valid, fail the mission.

### 7.4 Worker

- **Limits:** 8 model steps and 6 tool calls. **Timeouts:** 90 s for a model call, 30 s for a tool call. These limits keep each action much shorter than the Convex action limit of 10 minutes.
- **Input:** the node instructions, the goal, and the outputs of its dependencies.
- **Each step:**
  1. Check the stop flag and the kill flag.
  2. Get a slot from the rate limiter. While it waits, write `node_queued`. If the wait is longer than 60 s, throw a retryable error.
  3. Stream the text to `nodeLive`.
  4. Write the `thought`, `llm_usage`, `tool_call`, and `tool_result` events.
- **The worker stops when:**
  - it calls `write_section`, or
  - the model makes no tool call, or
  - the mission budget is empty.

### 7.5 Tools

The web tools only read. `app_write` is the only tool that changes something outside the app: it creates new items, only in apps where the user turned on Write. A tool error goes back to the model as data. It does not stop the worker.

| Tool | Roles | Behavior |
|---|---|---|
| `web_search` | researcher | Search on the first service with a key and searches left: Linkup, then Exa, then Tavily (`convex/engine/tools/search.ts`). A service that is out of searches, returns an error, or takes more than 9 s passes the query to the next one. An empty result does not. When no service is left, the tool tells the model to use `fetch_url`. Each service has a daily cap (§8). |
| `fetch_url` `{ url, focus? }` | researcher | Gets one page. See the steps below. |
| `app_search` `{ app, query }` | librarian | One read-only Composio search action of a connected app with Read on (`convex/engine/tools/appActions.ts`). |
| `app_write` `{ app, title, content, target? }` | librarian | One create-only Composio action of an app with Write on: a Notion page, Google Doc, Gmail draft (never sent), Slack message, or GitHub issue. 2 for each task at most. |
| `write_section` | researcher, writer, librarian | Sends the final section and its sources. It ends the worker loop. |

**Librarian and Composio.** The orchestrator gets the usable apps of the user with the goal, and plans a librarian task only when apps are listed (the plan check rejects it otherwise). The librarian never reads the web. The tool definitions list only the allowed apps, as an enum. Each app call runs in `engine/appTools.run` (Node): it checks the permission again (the user can change it during the mission), then opens a Composio session with the direct-tools preset that allows exactly one action of one app, with no meta tools, no connection prompts, and no sandbox, and runs `session.execute`. Results go back to the model inside `<app_content>` as untrusted data, as numbered items with a title, URL, and snippet (and the page ID for Notion). The Composio user ID is a hash of the token identifier. In simulated mode the app tools return made-up items with app-like links.

`fetch_url` does these steps:

1. Get the page from Jina Reader. If this fails, fetch the page directly.
2. For a direct fetch, apply the SSRF guard:
   - Allow only http and https.
   - Block private, loopback, link-local, and metadata IP ranges. Check again after each redirect.
   - Stop at 5 MB or 15 s.
3. Split the page into chunks of approximately 1,500 characters.
4. Rank the chunks with BM25 against `focus`. If there is no `focus`, use the node instructions.
5. Send the top chunks to the model, 8,000 characters maximum. Save the full text as an artifact.

Free models often have small context windows. Steps 3–5 keep the prompts small.

### 7.6 Assembler

- The assembler merges the worker outputs into deliverable version 1. It removes duplicate sources.
- If a worker failed, the report tells about the missing part.
- In a follow-up, `rewrite` merges the task outputs again with the instruction of the user. `revise` gets the latest version and the instruction, and edits the text. Both write the next version on the assembler node.

### 7.7 Simulated mode

- Turn it on with `LLM_MODE=simulated`, or for one mission in development.
- It plays scripts from `convex/engine/llm/scripts/`. Each script has a seed and realistic delays. It does not call OpenRouter or a search service.
- The E2E tests use simulated mode.
- The landing page plays `fixtures/missions/landing.json` in the browser only. It needs no backend.

## 8. Limits

| Limit | Type | Key | Value |
|---|---|---|---|
| OpenRouter per minute | token bucket | global | 18 per minute, capacity 4 |
| OpenRouter per day | fixed window (UTC day) | global | `OPENROUTER_DAILY_CAP` minus 5% |
| Missions per user | fixed window (day) | `userId` | 3 |
| Linkup per day | fixed window (day) | global | 130 (approximately 4,000 each month) |
| Exa per day | fixed window (day) | global | 25 (approximately $10 each month) |
| Tavily per day | fixed window (day) | global | 30 (approximately 1,000 each month) |
| Mission budget | engine counter | mission | 60 model calls |
| Steers (v2) | token bucket | `userId` | 10 per minute |

- The search caps follow the free plans. None of the three plans needs a card. Together they give approximately 185 searches each day. `LINKUP_DAILY_CAP`, `EXA_DAILY_CAP`, and `TAVILY_DAILY_CAP` override them.
- Linkup gives the free credit only to an account with a work email. Exa can bill highlights by the page, so its cap assumes $0.012 for each search.
- The account has the 1,000-per-day tier ($10 credits). Set `OPENROUTER_DAILY_CAP=1000`. This gives approximately 25–40 missions each day for all users together.
- **Admission:** If fewer than 45 daily calls remain, `missions.create` refuses the mission with `CAPACITY_EXHAUSTED`. Running missions continue.
- **429 errors:** If OpenRouter still sends a 429, wait for `Retry-After`. Then try again with backoff. The maximum is 3 attempts.

## 9. Frontend

### 9.1 Event loading

1. On first load, get the history with `events.page`. Each page has 500 events.
2. Then subscribe to `events.tail(afterSeq)`. It returns 200 events maximum.
3. When the result has 150 events, move the cursor forward. Keep the old events in client memory.

Thus each reactive update stays small, also for a long mission.

### 9.2 Reducer

- The reducer applies only new events.
- Its output: mission status and stats, nodes, edges, satellites, packets, stream items, and deliverable versions.
- Each packet has the seq of its event. The canvas animates only packets that are newer than the last render. Thus a replay scrub does not play old packets.
- The reducer ignores unknown event types. Thus an old client works with a new backend.
- Live thoughts come from a separate subscription. Replay does not use them.

### 9.3 Graph

- **Layout:** dagre, left to right, with nodes sorted by ID. Thus the layout is deterministic. The layout runs again only when nodes or edges change. A status change does not start a layout.
- **Motion:** Nodes move to new positions with a spring animation. New nodes start at the position of their parent.
- **Nodes:** Each custom node is memoized and reads only its own part of the store. Thus a live thought updates only one node.
- **Packets:** Packets move on the SVG path of the edge with motion values, outside React renders. The maximum is 10 packets at one time.
- **Reduced motion:** No packets. The active edge shows a static pulse.
- **Follow mode:** It keeps the running nodes in view. A manual pan or zoom turns it off.

### 9.4 Other views

- The mission stream panel and the trace drawer read the same reducer state.
- The trace drawer loads artifacts only when the user opens a step.
- **First paint:** An RSC shell preloads the mission and its first events. The live parts are client components.

## 10. Auth and security

- Better Auth runs in Convex. The Next.js route `/api/auth/[...all]` sends auth requests to Convex. The client uses `ConvexBetterAuthProvider`.
- **Sign-in methods:**
  - v1: email and password, GitHub, Google.
  - v2: email verification and password reset, with Resend.
- `proxy.ts` only looks for a session cookie and redirects. It does not read the database.
- Each Convex function calls `requireUser`. The `(app)` layout checks the session again. A request for the data of a different user returns "not found".
- Keep all secrets in Convex environment variables. The browser gets only public URLs.
- Prompts mark web content as untrusted data. All tools are read-only. Thus a malicious page can only make a bad report.
- The markdown renderer does not allow raw HTML. Links use `rel="noopener noreferrer nofollow"`.
- **Share pages (v2):** random slugs of 12 or more characters, revocable, redacted (no prompts, no user details), and `noindex`.

## 11. Errors

| Failure | Behavior |
|---|---|
| Provider 429 or 5xx, or bad output | Try again, then use the next model, then write `node_failed`. |
| Plan not valid | Ask again 2 times, then use the next model, then write `mission_failed`. |
| Tool error | Send the error to the model as data. |
| Worker fails permanently | The dependent nodes continue. The mission ends as `partial`. |
| Action timeout | The workflow tries the step 1 more time, then writes `node_failed`. |
| Low daily capacity | Refuse new missions. Running missions continue. |
| Stuck mission | Every 5 minutes, a cron job fails each active mission with no activity for 10 minutes. The limit for `awaiting_approval` is 24 hours. |
| Client disconnects | No effect on the engine. The client continues from `lastSeq` when it connects again. |

UI error codes: `UNAUTHENTICATED`, `NOT_FOUND`, `QUOTA_EXCEEDED`, `CAPACITY_EXHAUSTED`, `INVALID_INPUT`, `MISSION_NOT_ACTIVE`.

## 12. v2 approaches

### 12.1 Critic (FR-32)

- Each node runs as worker → critic. The critic returns `{ verdict, reasons }`.
- If the critic rejects the output, the worker runs again with the feedback. The maximum is 2 rejects.
- After the second reject, the engine accepts the output, sets a flag, and adds an Inbox item.
- Critic calls use the mission budget and the global limits.

### 12.2 Approval gates (FR-33)

- The workflow checks gates only between waves. An action cannot wait for an event, but a workflow can.
- A gate opens when:
  - the remaining budget is less than the cost of the next wave (approximately 6 calls for each ready node), or
  - a plan has more than 8 workers, or adds more than 2 nodes at one time.
- The workflow adds an `approvals` row, sets the status to `awaiting_approval`, and waits with `step.awaitEvent`.
- The mutation `approvals.resolve` records the decision and sends the event.
- **Approve:** add 50% to the budget, or apply the plan change. **Deny:** continue without the change.

### 12.3 Steering (FR-34)

- **Immediate actions:**
  - Kill sets `killRequested`. The worker stops at its next check.
  - Edit changes the instructions of a pending node.
  - Add branch adds a node.
- **Notes:** A note starts a `replan` at the next wave boundary. The orchestrator gets the plan, the node statuses, and the notes. It returns a diff that can change only pending nodes.
- The engine validates the diff as a DAG. The gates in 12.2 apply.
- The maximum is 3 replans for each mission. After that, the UI tells the user that notes have no effect.

### 12.4 Replay (FR-35)

- The reducer runs to a cursor. The client keeps a snapshot every 50 events. Thus a scrub starts from the nearest snapshot.
- Idle gaps longer than 1.5 s become 400 ms. Speeds: 1×, 2×, 4×.
- "Jump to next" goes to the next `plan_created`, `critic_reviewed`, `approval_requested`, `node_done`, or `deliverable_ready` event.

### 12.5 Share (FR-36)

- `shares.publish` works only for finished missions.
- `/r/[slug]` shows a read-only replay. The OG image shows the final graph.
- `shares.revoke` sets `revokedAt`. After that, the slug returns "not found".

### 12.6 Custom agents and memory (FR-37, FR-38)

- In the composer, the user can `@mention` an agent. The orchestrator can give a node to an agent with `agentId`.
- A worker for an agent uses the instructions, the tool allowlist, and the model chain of that agent.
- **Memory:**
  1. After each mission, the agent saves learnings of 600 characters maximum.
  2. On the next run, the agent gets the top 5 memories from a Convex search query (BM25) against the task.
  3. The agent also gets its 3 most recent memories.
- The config canvas uses the same graph components.

### 12.7 Schedules (FR-39)

- A schedule has a cron expression and a timezone.
- The engine calls `scheduler.runAt(nextRunAt)`. After each run, it schedules the next run.
- Scheduled runs use the daily quota. If the quota is empty, the engine skips the run and adds an Inbox item.
- Results go to the Inbox.

### 12.8 Export and usage (FR-41, FR-42)

- The client makes the PDF from the markdown.
- Usage charts read `usageDaily` and the `llm_usage` events.

## 13. Tests

| Level | Tool | Scope |
|---|---|---|
| Pure logic | Vitest | Reducer (incremental result = full result; replay at any seq), plan DAG validation, layout determinism, gap compression. |
| Backend | convex-test | Quota and admission, seq order, auth scope (user A cannot read the data of user B), engine actions with the simulated client. |
| Workflow | Dev deployment, simulated mode | Full run, stop, and (v2) gates and steers. We do not know yet if convex-test supports the Workflow component. |
| E2E | Playwright, simulated mode | Sign up → mission → graph → trace → complete → download → revise. v2 adds gates, replay, and share. |

**Rule:** Each new event type must have reducer tests and a fixture.

## 14. Configuration

- **Convex environment:** `OPENROUTER_API_KEY`, `OPENROUTER_DAILY_CAP`, `LLM_MODE`, `LINKUP_API_KEY`, `EXA_API_KEY`, `TAVILY_API_KEY` (one or more), `JINA_API_KEY` (optional), `BETTER_AUTH_SECRET`, `SITE_URL`, GitHub and Google OAuth keys, `RESEND_API_KEY` (v2).
- **Next.js environment:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`.

## 15. Decisions

| Decision | Reason |
|---|---|
| Convex, not Postgres + job runner + SSE | One system gives realtime, durable runs, and rate limits. |
| Better Auth, not Clerk | Open source. User data stays in Convex. We control the auth UI. |
| Event log + one reducer | Replay, share, the landing demo, and debug use one code path. |
| Waves, not dynamic scheduling | The workflow stays deterministic. Steers, replans, and gates have clear points to apply. |
| dagre + springs, not a force simulation | The layout is stable and deterministic, and it still animates. |
| `nodeLive` outside the log; artifacts outside events | The log stays small. Live updates stay light. |
| Simulated mode | The shared free quota is too small for development. |
| Vercel AI SDK, not LangChain | The AI SDK does multi-step tool calls and structured output. LangChain adds a second layer and makes our event emission harder. |
| BM25, not embeddings | Page chunks and memories are small and use many keywords. BM25 uses no model calls from the free quota. |
| No Langfuse in v1 | The event log and trace drawer already show each call. Add Langfuse (with AI SDK telemetry) later to compare prompts or models across many runs. |

## 16. Risks

| Risk | Mitigation |
|---|---|
| Free models disappear or lose tool support | Daily catalog update and model chains. The model ID in each `node_started` and `llm_usage` event shows which models fail. |
| High write rate from `nodeLive` | 4 writes each second or less for each active node. The rate limiter keeps active nodes at approximately 6 maximum. |
| A search quota is empty | Three services, each with a daily soft cap. The next service takes the query. When all are empty, the tool tells the model to use `fetch_url`. |
| convex-test does not support the Workflow component | Test workflows on a dev deployment in simulated mode. |
