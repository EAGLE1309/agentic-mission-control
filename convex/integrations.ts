import { query } from "./_generated/server";
import { configuredSocialProviders } from "./auth";
import { resolveMode } from "./engine/llm/client";
import { requireUser } from "./lib/auth";

/**
 * Which services are set up, for the Integrations page (FR-29, design §6.8).
 * Only booleans leave the server, never a key.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const social = configuredSocialProviders();
    return {
      mode: resolveMode(),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      tavily: Boolean(process.env.TAVILY_API_KEY),
      jina: Boolean(process.env.JINA_API_KEY),
      github: social.github !== undefined,
      google: social.google !== undefined,
      composio: Boolean(process.env.COMPOSIO_API_KEY),
    };
  },
});
