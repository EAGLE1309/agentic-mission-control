import type { AgentRole } from "./agents";
import type { ModelProfile } from "./events";

// Model chains (tech spec §7.2). Each role gets an ordered list of free
// OpenRouter models. When a model fails, the engine uses the next one. To
// change a model, change only this file. Picked from the free list of
// 2026-09-26; the daily catalog skips a model that is gone for 48 hours.
// BLOCKED_MODELS are never used, not even from env.

export type ModelChains = Record<AgentRole, readonly string[]>;

/**
 * Models that are never used: they answered almost every call with a
 * temporary rate limit (2026-09-26).
 */
export const BLOCKED_MODELS: ReadonlySet<string> = new Set(["qwen/qwen3.8-27b:free", "google/gemma-4-26b-a4b-it:free"]);

export const MODEL_PRESETS: Record<ModelProfile, ModelChains> = {
  balanced: {
    orchestrator: [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "dots-studio/dots-3-note-preview:free",
      "google/gemma-4-31b-it:free",
    ],
    researcher: [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "thinkingmachines/inkling:free",
      // openrouter/free only at the end of the researcher chain: its abilities change from call to call.
      "openrouter/free",
    ],
    writer: ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free", "thinkingmachines/inkling:free"],
    librarian: ["nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free", "thinkingmachines/inkling:free"],
    assembler: ["nvidia/nemotron-3-ultra-550b-a55b:free", "thinkingmachines/inkling:free", "google/gemma-4-31b-it:free"],
  },
  fast: {
    orchestrator: ["nvidia/nemotron-3.5-lightning:free", "thinkingmachines/inkling-small:free", "google/gemma-4-31b-it:free"],
    researcher: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free", "openrouter/free"],
    writer: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free", "thinkingmachines/inkling:free"],
    librarian: ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free", "thinkingmachines/inkling:free"],
    assembler: ["thinkingmachines/inkling-small:free", "nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free"],
  },
};

/**
 * Model selection by environment (Convex env). OPENROUTER_MODELS sets one chain
 * for every agent. OPENROUTER_MODELS_<ROLE> sets the chain of one agent and wins.
 * Values are comma-separated OpenRouter model IDs, for example
 * "openrouter/free" or "google/gemma-4-31b-it:free,openrouter/free".
 */
export const MODELS_ENV = "OPENROUTER_MODELS";
export const ROLE_MODELS_ENV: Record<AgentRole, string> = {
  orchestrator: "OPENROUTER_MODELS_ORCHESTRATOR",
  researcher: "OPENROUTER_MODELS_RESEARCHER",
  writer: "OPENROUTER_MODELS_WRITER",
  librarian: "OPENROUTER_MODELS_LIBRARIAN",
  assembler: "OPENROUTER_MODELS_ASSEMBLER",
};

export type ModelOverrides = Partial<Record<AgentRole, string[]>>;

const MODEL_ID = /^[\w.-]+\/[\w.:-]+$/;
const MAX_CHAIN = 8;

/** Model IDs from an env value. Entries that are not model IDs, and blocked models, are skipped. */
export function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id) => MODEL_ID.test(id) && !BLOCKED_MODELS.has(id));
  return [...new Set(ids)].slice(0, MAX_CHAIN);
}

/** The overrides in an env object. A role value wins over the global value. */
export function modelOverrides(env: Record<string, string | undefined>): ModelOverrides {
  const global = parseModelList(env[MODELS_ENV]);
  const overrides: ModelOverrides = {};
  for (const [role, name] of Object.entries(ROLE_MODELS_ENV) as [AgentRole, string][]) {
    const own = parseModelList(env[name]);
    const chain = own.length > 0 ? own : global;
    if (chain.length > 0) overrides[role] = chain;
  }
  return overrides;
}

/** The chains in use: an override, or the preset. */
export function effectiveChains(profile: ModelProfile, overrides: ModelOverrides): ModelChains {
  const preset = MODEL_PRESETS[profile];
  return {
    orchestrator: overrides.orchestrator ?? preset.orchestrator,
    researcher: overrides.researcher ?? preset.researcher,
    writer: overrides.writer ?? preset.writer,
    librarian: overrides.librarian ?? preset.librarian,
    assembler: overrides.assembler ?? preset.assembler,
  };
}

/** Roles that call tools need models with tool support. */
export const ROLES_WITH_TOOLS: readonly AgentRole[] = ["researcher", "writer", "librarian"];

/** A catalog model that has not been in the list for this long is skipped. */
export const CATALOG_STALE_MS = 48 * 60 * 60 * 1000;
