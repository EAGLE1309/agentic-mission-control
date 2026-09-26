import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { MissionMode, ModelProfile } from "../../../src/shared/events";
import { modelOverrides } from "../../../src/shared/models";
import { createOpenRouterClient } from "./openrouter";
import { createSimulatedClient } from "./simulated";
import { LlmError, type LlmClient } from "./types";

/**
 * The mode of a new mission. LLM_MODE wins. Without it, simulated mode runs
 * when no OpenRouter key is set, so development works with no keys.
 */
export function resolveMode(): MissionMode {
  const mode = process.env.LLM_MODE;
  if (mode === "simulated" || mode === "live") return mode;
  return process.env.OPENROUTER_API_KEY ? "live" : "simulated";
}

/** The client for an engine action. Live mode reads the model catalog first. */
export async function loadLlmClient(ctx: ActionCtx, mode: MissionMode, profile: ModelProfile): Promise<LlmClient> {
  if (mode === "simulated") return createSimulatedClient();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LlmError("OPENROUTER_API_KEY is not set. Set it in the Convex environment, or set LLM_MODE=simulated.", false);
  }
  const catalog = await ctx.runQuery(internal.catalog.snapshot, {});
  return createOpenRouterClient({
    apiKey,
    profile,
    catalog,
    now: Date.now(),
    siteUrl: process.env.SITE_URL,
    overrides: modelOverrides(process.env),
  });
}
