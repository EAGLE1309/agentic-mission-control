/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apps from "../apps.js";
import type * as artifacts from "../artifacts.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as composio from "../composio.js";
import type * as crons from "../crons.js";
import type * as deliverables from "../deliverables.js";
import type * as engine_appTools from "../engine/appTools.js";
import type * as engine_assemble from "../engine/assemble.js";
import type * as engine_emit from "../engine/emit.js";
import type * as engine_fetchPage from "../engine/fetchPage.js";
import type * as engine_gate from "../engine/gate.js";
import type * as engine_liveText from "../engine/liveText.js";
import type * as engine_llm_client from "../engine/llm/client.js";
import type * as engine_llm_json from "../engine/llm/json.js";
import type * as engine_llm_openrouter from "../engine/llm/openrouter.js";
import type * as engine_llm_simulated from "../engine/llm/simulated.js";
import type * as engine_llm_types from "../engine/llm/types.js";
import type * as engine_plan from "../engine/plan.js";
import type * as engine_prompts from "../engine/prompts.js";
import type * as engine_random from "../engine/random.js";
import type * as engine_save from "../engine/save.js";
import type * as engine_state from "../engine/state.js";
import type * as engine_tools_appActions from "../engine/tools/appActions.js";
import type * as engine_tools_bm25 from "../engine/tools/bm25.js";
import type * as engine_tools_html from "../engine/tools/html.js";
import type * as engine_tools_live from "../engine/tools/live.js";
import type * as engine_tools_registry from "../engine/tools/registry.js";
import type * as engine_tools_search from "../engine/tools/search.js";
import type * as engine_tools_simulated from "../engine/tools/simulated.js";
import type * as engine_tools_ssrf from "../engine/tools/ssrf.js";
import type * as engine_worker from "../engine/worker.js";
import type * as engine_workflow from "../engine/workflow.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as integrations from "../integrations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_composio from "../lib/composio.js";
import type * as lib_stats from "../lib/stats.js";
import type * as limits from "../limits.js";
import type * as live from "../live.js";
import type * as missions from "../missions.js";
import type * as shell from "../shell.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apps: typeof apps;
  artifacts: typeof artifacts;
  auth: typeof auth;
  catalog: typeof catalog;
  composio: typeof composio;
  crons: typeof crons;
  deliverables: typeof deliverables;
  "engine/appTools": typeof engine_appTools;
  "engine/assemble": typeof engine_assemble;
  "engine/emit": typeof engine_emit;
  "engine/fetchPage": typeof engine_fetchPage;
  "engine/gate": typeof engine_gate;
  "engine/liveText": typeof engine_liveText;
  "engine/llm/client": typeof engine_llm_client;
  "engine/llm/json": typeof engine_llm_json;
  "engine/llm/openrouter": typeof engine_llm_openrouter;
  "engine/llm/simulated": typeof engine_llm_simulated;
  "engine/llm/types": typeof engine_llm_types;
  "engine/plan": typeof engine_plan;
  "engine/prompts": typeof engine_prompts;
  "engine/random": typeof engine_random;
  "engine/save": typeof engine_save;
  "engine/state": typeof engine_state;
  "engine/tools/appActions": typeof engine_tools_appActions;
  "engine/tools/bm25": typeof engine_tools_bm25;
  "engine/tools/html": typeof engine_tools_html;
  "engine/tools/live": typeof engine_tools_live;
  "engine/tools/registry": typeof engine_tools_registry;
  "engine/tools/search": typeof engine_tools_search;
  "engine/tools/simulated": typeof engine_tools_simulated;
  "engine/tools/ssrf": typeof engine_tools_ssrf;
  "engine/worker": typeof engine_worker;
  "engine/workflow": typeof engine_workflow;
  events: typeof events;
  http: typeof http;
  inbox: typeof inbox;
  integrations: typeof integrations;
  "lib/auth": typeof lib_auth;
  "lib/composio": typeof lib_composio;
  "lib/stats": typeof lib_stats;
  limits: typeof limits;
  live: typeof live;
  missions: typeof missions;
  shell: typeof shell;
  usage: typeof usage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
