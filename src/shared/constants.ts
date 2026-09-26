// All tunable numbers. Sources: tech spec §7–§9, design §5.7 and §6.4.

// Plan (tech spec §7.3)
export const PLAN_MIN_TASKS = 2;
export const PLAN_MAX_TASKS = 6;
export const PLAN_REPAIR_ATTEMPTS = 2;

// Worker (tech spec §7.4)
export const WORKER_MAX_STEPS = 8;
export const WORKER_MAX_TOOL_CALLS = 6;
export const MODEL_CALL_TIMEOUT_MS = 90_000;
export const TOOL_CALL_TIMEOUT_MS = 30_000;
export const RATE_LIMIT_MAX_WAIT_MS = 60_000;
/** Provider requests for one model call, over all models and 429 retries. */
export const MODEL_ATTEMPTS_PER_CALL = 3;
/** A worker stops starting new steps after this, so the action stays far below the 10-minute limit. */
export const WORKER_DEADLINE_MS = 7 * 60_000;
export const NODE_LIVE_MIN_INTERVAL_MS = 250;

// web_search and fetch_url (tech spec §7.5)
export const FETCH_MAX_BYTES = 5 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;
/** Jina Reader gets less, so Jina and the direct fallback fit in the 30s tool timeout. */
export const JINA_TIMEOUT_MS = 10_000;
export const SEARCH_RESULTS = 5;
/** The characters of each search result that the model reads. */
export const SEARCH_SNIPPET_CHARS = 400;
/** One search service gets less, so three services fit in the 30s tool timeout. */
export const SEARCH_TIMEOUT_MS = 9_000;
/** Web search services, in the order that web_search tries them (tech spec §7.5). */
export const SEARCH_ORDER = ["linkup", "exa", "tavily"] as const;
export const FETCH_MAX_REDIRECTS = 5;
export const CHUNK_CHARS = 1_500;
export const FETCH_CONTEXT_MAX_CHARS = 8_000;

// Limits (tech spec §8)
export const OPENROUTER_PER_MINUTE = 18;
export const OPENROUTER_BURST = 4;
export const OPENROUTER_DAILY_SAFETY = 0.05;
export const MISSIONS_PER_USER_PER_DAY = 3;
/** Searches each day for all users, per service: the free plan of each month over 30 days. */
export const SEARCH_PER_DAY = { linkup: 130, exa: 25, tavily: 30 } as const;
export const MISSION_CALL_BUDGET = 60;
export const ADMISSION_MIN_DAILY_CALLS = 45;
export const PROVIDER_429_MAX_ATTEMPTS = 3;

// Missions (tech spec §7.1, §11)
/** Follow-up turns in the chat of one mission (FR-25). Each can write a report version. */
export const MAX_FOLLOW_UPS = 10;
export const GOAL_MAX_CHARS = 4_000;
export const FOLLOW_UP_MAX_CHARS = 2_000;
/** Model calls that each follow-up turn adds to the mission budget. */
export const FOLLOW_UP_CALL_BUDGET = 40;
/** Tasks in one mission, with the tasks that follow-ups add. */
export const MAX_TASKS_TOTAL = 12;
export const STUCK_MISSION_MS = 10 * 60_000;
export const STUCK_SWEEP_MINUTES = 5;

// Events and artifacts (tech spec §3.1, §5.1, §9.1)
export const PREVIEW_MAX_CHARS = 500;

/** Items that one librarian task can create with app_write. */
export const APP_WRITES_MAX = 2;

/** Result URLs that a tool_result carries, for favicons (design §6.4). */
export const RESULT_URLS_MAX = 8;
/** Favicons on one graph satellite: the newest sites of that tool. */
export const SATELLITE_SITES_MAX = 3;
export const ARTIFACT_MAX_CHARS = 200_000;
export const EVENTS_PAGE_SIZE = 500;
export const EVENTS_TAIL_LIMIT = 200;
export const EVENTS_TAIL_ADVANCE_AT = 150;

// Graph (tech spec §9.3, design §6.4)
export const PACKET_BUFFER = 32;
export const MAX_ACTIVE_PACKETS = 10;

// Accounts (FR-2)
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;

// Prompt inputs: free models often have small context windows.
export const DEPENDENCY_INPUT_MAX_CHARS = 6_000;
export const SECTION_INPUT_MAX_CHARS = 8_000;
export const REPORT_INPUT_MAX_CHARS = 24_000;
