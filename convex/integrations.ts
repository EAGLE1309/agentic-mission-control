import { query } from "./_generated/server";
import { configuredSocialProviders } from "./auth";
import { resolveMode } from "./engine/llm/client";
import { configuredServices } from "./engine/tools/search";
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
    const search = new Set(configuredServices(process.env).map((item) => item.service));
    return {
      mode: resolveMode(),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      linkup: search.has("linkup"),
      exa: search.has("exa"),
      tavily: search.has("tavily"),
      jina: Boolean(process.env.JINA_API_KEY),
      github: social.github !== undefined,
      google: social.google !== undefined,
      composio: Boolean(process.env.COMPOSIO_API_KEY),
    };
  },
});
