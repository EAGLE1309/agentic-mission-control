import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import type { AgentRole } from "../src/shared/agents";
import { effectiveChains, modelOverrides } from "../src/shared/models";

// The free model catalog (tech spec §7.2). The model list of OpenRouter is
// public, so the refresh needs no key.

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const MAX_MODELS = 500;

const catalogModel = v.object({
  modelId: v.string(),
  name: v.string(),
  contextLength: v.number(),
  supportsTools: v.boolean(),
  supportsStructured: v.boolean(),
});

type CatalogModel = { modelId: string; name: string; contextLength: number; supportsTools: boolean; supportsStructured: boolean };

/** Read one model entry of the OpenRouter list. The body is untrusted: check each field. */
function parseModel(raw: unknown): CatalogModel | null {
  if (typeof raw !== "object" || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== "string" || !entry.id) return null;
  const pricing = (typeof entry.pricing === "object" && entry.pricing !== null ? entry.pricing : {}) as Record<string, unknown>;
  const free = entry.id.endsWith(":free") || (Number(pricing.prompt) === 0 && Number(pricing.completion) === 0);
  if (!free) return null;
  const parameters = Array.isArray(entry.supported_parameters)
    ? entry.supported_parameters.filter((item): item is string => typeof item === "string")
    : [];
  return {
    modelId: entry.id,
    name: typeof entry.name === "string" ? entry.name : entry.id,
    contextLength: typeof entry.context_length === "number" ? entry.context_length : 0,
    supportsTools: parameters.includes("tools"),
    supportsStructured: parameters.includes("structured_outputs"),
  };
}

export const refresh = internalAction({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const response = await fetch(MODELS_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`The OpenRouter model list did not load (HTTP ${response.status}).`);
    const body: unknown = await response.json();
    const data = typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
    if (!Array.isArray(data)) throw new Error("The OpenRouter model list has an unknown shape.");
    const models = data.map(parseModel).filter((model): model is CatalogModel => model !== null).slice(0, MAX_MODELS);
    await ctx.runMutation(internal.catalog.upsert, { models, seenAt: Date.now() });
    return { count: models.length };
  },
});

export const upsert = internalMutation({
  args: { models: v.array(catalogModel), seenAt: v.number() },
  handler: async (ctx, args) => {
    for (const model of args.models) {
      const row = await ctx.db
        .query("modelCatalog")
        .withIndex("by_modelId", (q) => q.eq("modelId", model.modelId))
        .unique();
      if (row) await ctx.db.patch("modelCatalog", row._id, { ...model, lastSeenAt: args.seenAt });
      else await ctx.db.insert("modelCatalog", { ...model, lastSeenAt: args.seenAt });
    }
  },
});

/** The catalog for the LLM client: which models exist and what they support. */
export const snapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("modelCatalog").take(MAX_MODELS);
    return rows.map((row) => ({
      modelId: row.modelId,
      supportsTools: row.supportsTools,
      supportsStructured: row.supportsStructured,
      lastSeenAt: row.lastSeenAt,
    }));
  },
});

/** Catalog facts for the Agents page (FR-29). */
export const models = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("modelCatalog").take(MAX_MODELS);
    return rows.map((row) => ({
      modelId: row.modelId,
      name: row.name,
      contextLength: row.contextLength,
      supportsTools: row.supportsTools,
      lastSeenAt: row.lastSeenAt,
    }));
  },
});

/** The model chains in use for each profile, with env overrides (FR-29). */
export const chains = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const overrides = modelOverrides(process.env);
    return {
      balanced: effectiveChains("balanced", overrides),
      fast: effectiveChains("fast", overrides),
      fromEnv: Object.keys(overrides) as AgentRole[],
    };
  },
});
