# Mission Control — Product Requirements

**Date:** 2026-09-26 · **Related:** [`tech-spec.md`](./tech-spec.md)

## 1. Summary

Mission Control is a SaaS web app. A user types a goal. An AI orchestrator divides the goal into tasks and shows them as a live graph. Worker agents do the tasks in parallel with tools. The user can open the full trace of each agent. At the end, the app assembles a report.

Most agent products show only a spinner. Mission Control shows the process. In v2, the user can also steer and replay it.

## 2. Goals

1. Show the product well. A new user goes from a goal to a report and sees all the work.
2. Operate as a real product: accounts, history, quotas, and error handling. The app can run in public without supervision.
3. Use only free models (OpenRouter). Continue to operate when a limit occurs.
4. Release in two versions: v1 (the core loop) and v2 (complete).

## 3. Not in scope

- Billing and payments.
- Native mobile apps. The web app works on mobile, but desktop is the primary target.
- Agents that edit, delete, send, or buy outside the app. The one exception is app write (FR-29): the Librarian creates new items (a page, document, issue, message, or email draft) only in apps where the user turned on Write.
- General chat. Each conversation is a mission.

## 4. Users

| User | Need |
|---|---|
| Visitor | Understand the product in seconds from the landing demo. Then sign up. |
| Member | Run a few missions each day. Watch them, open traces, download the report, and see the history. |
| Owner | Pay nothing for inference. Stay in the shared rate limits. See what runs. |

## 5. Constraints

- **Model quota:** OpenRouter free models allow 20 requests each minute and 1,000 each day. The owner account has this tier ($10 credits). All users share this one account.
- **Mission cost:** One mission uses approximately 25–40 model calls. Thus the app can run approximately 25–40 missions each day for all users together.
- **Free models:** They change often, and their tool calls are not always correct. The app must continue when a model disappears or gives bad output.
- **Search quota:** Three search services have free plans without a card: Linkup (approximately 4,000 searches each month), Exa ($10 of searches each month), and Tavily (1,000 searches each month). The quotas are for all users together.
- **Long runs:** A mission takes minutes. It must continue when the user closes the tab.

## 6. Terms

| Term | Meaning |
|---|---|
| Mission | One goal from a user. Its status goes from queued to planning, running, and assembling, and then to completed, failed, or stopped. |
| Plan | The 2–6 worker tasks that the orchestrator makes, with their dependencies. |
| Node | One unit of work in the graph: orchestrator, worker, critic (v2), assembler, or revision. |
| Role | The job and prompt of an agent: Orchestrator, Researcher, Writer, Critic (v2), Assembler. |
| Tool | An action that a worker can call: `web_search`, `fetch_url`, `write_section`. |
| Event | A record of one thing that occurred in a mission. The UI shows only data from events. |
| Trace | All events and artifacts of one node: reasoning, tool inputs and outputs, times, and tokens. |
| Deliverable | The final markdown report with sources. Each revision makes a new version. |
| Quota | The missions that one user can start each day, and the global capacity from the OpenRouter limits. |

## 7. v1 requirements

The v1 target: the full loop works from end to end, and each screen is complete.

### 7.1 Landing and auth

- **FR-1** The public landing page plays a recorded mission on a live graph. It needs no backend and no sign-in.
- **FR-2** A user can sign up and sign in with email and password, GitHub, or Google.
- **FR-3** All app routes need a session. The app sends a signed-out user to sign-in, and then back to the requested page.
- **FR-4** A user can sign out. The profile shows the name and the avatar from OAuth.

### 7.2 App shell

- **FR-5** The sidebar has these items: New mission, Inbox, Missions, Templates, Tools, Agents, Usage, Settings. The Agents item shows the built-in roles, each with a live-activity indicator.
- **FR-6** The command palette (⌘K / Ctrl+K) opens missions, templates, and pages.
- **FR-7** The app has a light theme and a dark theme. The default follows the system setting.

### 7.3 New mission

- **FR-8** The composer accepts a goal of many lines. Enter sends the goal. Shift+Enter adds a new line. A picker selects the model profile.
- **FR-9** A banner shows the missions that remain today. If the global capacity is empty, the banner tells the user.
- **FR-10** The screen shows 4–6 templates. A template fills the composer.
- **FR-11** After the user sends a goal, the app opens the run view. The first activity shows in 3 seconds or less.

### 7.4 Mission engine

- **FR-12** The orchestrator makes a plan of 2–6 tasks with dependencies. If a plan is not valid, the engine tries again. The user never sees a partial plan.
- **FR-13** Workers run in parallel when their dependencies allow. The global rate limits control their speed. A worker that waits shows the status "queued".
- **FR-14** Workers use `web_search`, `fetch_url`, and `write_section`. Each worker output shows its sources.
- **FR-15** The assembler merges the worker outputs into one markdown report with a sources section.
- **FR-16** Each mission has a fixed budget of model calls. A mission never uses more than its budget.
- **FR-17** Missions run on the server. They continue when the user closes the tab. When the user opens the mission again, it shows the current state.
- **FR-18** The user can stop a running mission. The app keeps the completed work.
- **FR-19** If a worker fails permanently, the mission continues. The report tells about the missing part. The mission shows "partial".

### 7.5 Run view

- **FR-20** Live graph:
  - Nodes appear when the plan forms.
  - Each node shows its role, title, status, current tool, and a live one-line thought.
  - Tool activity moves along the edges.
  - Completed nodes show a settled state.
  - The deliverable node completes last.
- **FR-21** A stream panel is next to the graph. It shows the orchestrator narration, the elapsed time, the token count, a checklist of tool calls, and the status of each sub-agent.
- **FR-22** When the user clicks a node, its trace opens. The trace shows the instructions, the reasoning for each step, the input and output of each tool call, times, tokens, and errors.
- **FR-23** Graph controls: zoom, fit to view, and follow mode. Follow mode keeps the active nodes in view.

### 7.6 Deliverable and follow-up

- **FR-24** The report shows as formatted markdown with sources that the user can click. The user can copy the report or download it as `.md`.
- **FR-25** After completion, the user can type a revision instruction. The revision shows as a new node on the graph and makes a new report version. The user can still see the old versions.

### 7.7 History, Inbox, usage

- **FR-26** The missions list shows the title, status, duration, tokens, and date. The user can search and filter by status.
- **FR-27** The Inbox shows a notification when a mission completes or fails. Each notification is read or unread.
- **FR-28** The Usage page shows the missions that remain today. It also shows the totals of missions and tokens for the user.
- **FR-29** The Integrations page shows the built-in tools, the services the agents use (models, web, sign-in) with their setup state, and third-party apps that the user connects and disconnects through Composio. For each connected app, the user turns Read (the Librarian searches it) and Write (the Librarian creates new items there) on and off. The Librarian joins a mission when the goal needs the user's own data or asks to save something. The Agents page shows the roles: descriptions, models, and prompts. The user cannot edit tools or roles.

### 7.8 Quality

- **FR-30** Each screen has a loading state, an empty state, and an error state. No screen is blank.
- **FR-31** Simulated mode runs scripted missions for developers. It does not call OpenRouter or a search service.

## 8. v2 requirements

The v2 target: the complete product.

- **FR-32 Critic loop.** A critic reviews each worker output.
  - If the critic rejects the output, the worker does the task again with the reasons. The maximum is 2 rejects.
  - The graph and the trace show the reject, the reasons, and the retry count.
  - After the second reject, the app accepts the output with a warning flag and adds an Inbox item.
- **FR-33 Approval gates.** The mission pauses. The affected node shows "waiting" until the user approves or denies. The user can decide on the graph or in the Inbox. A gate occurs when:
  - the mission reaches its call budget and the orchestrator asks for more, or
  - a plan would have more than 8 workers, or would add more than 2 nodes at one time.
- **FR-34 Steering.** While a mission runs, the user can send guidance in the follow-up box. The orchestrator then changes the plan. On a node, the user can:
  - edit the instructions (pending nodes only),
  - kill the node (running or pending nodes),
  - add a branch.

  The graph animates the changes.
- **FR-35 Replay.** A timeline replays a finished mission. The controls are play, pause, speed (1×, 2×, 4×), scrub, and jump to the next event. The replay makes idle gaps shorter.
- **FR-36 Share.** The owner can publish a mission as a public, read-only replay. Nobody can guess the URL. The link has a social preview image. The owner can revoke the link.
- **FR-37 Custom agents.** A user can make an agent with a name, a description, instructions, a model, a tool allowlist, and optional memory. Each agent has a configuration canvas. The user can @mention agents in the composer. The orchestrator can give tasks to them.
- **FR-38 Agent memory.** If memory is on, the agent saves short learnings after each mission. On the next mission, it reads the most relevant learnings.
- **FR-39 Scheduled missions.** A goal runs on a cron schedule in the timezone of the user. The goal can include agents. Each run uses the quota. The results go to the Inbox.
- **FR-40 Full Inbox.** The Inbox shows approval requests, critic escalations, and the results of scheduled runs. The user can act on each item in the Inbox.
- **FR-41 Export.** The user can download the report as PDF. Copy and `.md` download also stay available.
- **FR-42 Usage analytics.** Charts show the model calls, tokens, and tool calls for each mission and for each day.
- **FR-43 Account.** Email verification and password reset.

**Stretch goals** (v2, only if time permits): code execution in a sandbox, teams and workspaces, and memory with vector search.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Speed | The first activity shows 3 s or less after the user sends a goal. A graph update shows 500 ms or less after the server event. |
| Smoothness | The graph stays smooth with 20 nodes and 10 tool animations at one time, on a mid-range laptop. |
| Reliability | 85% or more of missions complete (a partial mission counts as complete). No mission stays in "running" forever. The app finds stuck missions and fails them. |
| Capacity | The app never goes above the OpenRouter limits (20 each minute, and the daily cap). It refuses new missions before the capacity is empty. |
| Security | A user sees only their own missions and the published shares. Secrets never go to the browser. The app treats web content as untrusted. |
| Accessibility | The keyboard can operate the shell, the composer, and the trace panel. The app obeys the reduced-motion setting. The focus is always visible. |
| Observability | The event log is the debug record. The events can rebuild any mission. |

## 10. Success metrics

- Median time from goal to report: 4 minutes or less.
- Mission completion rate: 85% or more.
- Conversion from visitor to sign-up on the landing page (when analytics exist).
- v2: the number of times people open each published share link.

## 11. Release plan

| Version | Scope | Exit criteria |
|---|---|---|
| v1 | FR-1 to FR-31 | A new user signs up and runs a mission on real free models. The user watches it live, opens traces, downloads a report, and requests a revision. Simulated mode passes the E2E suite. |
| v2 | FR-32 to FR-43 | Critic rejects, approval gates, and steering work on live missions. Any finished mission can be replayed and shared in public. Custom agents and schedules work from end to end. |
