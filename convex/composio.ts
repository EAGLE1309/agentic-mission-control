"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { isAppSlug } from "../src/shared/apps";
import { appError } from "../src/shared/errors";
import { composioClient as client, composioUserIdFor } from "./lib/composio";

// Third-party apps through Composio (design §6.8). Composio runs the OAuth
// flow and holds the tokens. This app keeps only which apps each user
// connected, and it never trusts an account ID from the browser.

async function currentUser(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw appError("UNAUTHENTICATED");
  const userId = identity.tokenIdentifier;
  return { userId, composioUserId: composioUserIdFor(userId) };
}

/** Start the OAuth flow of one app. The browser goes to the returned URL. */
export const connect = action({
  args: { toolkit: v.string() },
  handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
    const { composioUserId } = await currentUser(ctx);
    if (!isAppSlug(args.toolkit)) throw appError("INVALID_INPUT", { message: "This app is not in the list." });
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw appError("APP_NOT_CONFIGURED");
    const composio = client();
    try {
      const session = await composio.create(composioUserId);
      const request = await session.authorize(args.toolkit, {
        callbackUrl: `${siteUrl}/integrations?app=${encodeURIComponent(args.toolkit)}`,
      });
      if (!request.redirectUrl) throw new Error("Composio returned no redirect URL.");
      return { redirectUrl: request.redirectUrl };
    } catch (error) {
      console.error(`Composio connect failed for ${args.toolkit}:`, error);
      throw appError("APP_CONNECT_FAILED");
    }
  },
});

/** Copy the active Composio connections of the user to appConnections. */
export const sync = action({
  args: {},
  handler: async (ctx): Promise<{ configured: boolean }> => {
    const { userId, composioUserId } = await currentUser(ctx);
    if (!process.env.COMPOSIO_API_KEY) return { configured: false };
    const composio = client();
    let items;
    try {
      ({ items } = await composio.connectedAccounts.list({
        userIds: [composioUserId],
        statuses: ["ACTIVE"],
        limit: 100,
      }));
    } catch (error) {
      console.error("Composio sync failed:", error);
      throw appError("APP_CONNECT_FAILED");
    }
    // The newest active account of each app wins.
    const latest = new Map<string, { connectedAccountId: string; updatedAt: string }>();
    for (const item of items) {
      const slug = item.toolkit.slug.toLowerCase();
      if (!isAppSlug(slug) || item.isDisabled) continue;
      const previous = latest.get(slug);
      if (!previous || item.updatedAt > previous.updatedAt) latest.set(slug, { connectedAccountId: item.id, updatedAt: item.updatedAt });
    }
    await ctx.runMutation(internal.apps.replace, {
      userId,
      connections: [...latest].map(([toolkit, value]) => ({ toolkit, connectedAccountId: value.connectedAccountId })),
      now: Date.now(),
    });
    return { configured: true };
  },
});

/** Delete the Composio accounts of one app for the user, then its row. */
export const disconnect = action({
  args: { toolkit: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const { userId, composioUserId } = await currentUser(ctx);
    if (!isAppSlug(args.toolkit)) throw appError("INVALID_INPUT", { message: "This app is not in the list." });
    const composio = client();
    try {
      const { items } = await composio.connectedAccounts.list({
        userIds: [composioUserId],
        toolkitSlugs: [args.toolkit],
        limit: 100,
      });
      for (const item of items) {
        if (item.toolkit.slug.toLowerCase() === args.toolkit) await composio.connectedAccounts.delete(item.id);
      }
    } catch (error) {
      console.error(`Composio disconnect failed for ${args.toolkit}:`, error);
      throw appError("APP_CONNECT_FAILED");
    }
    await ctx.runMutation(internal.apps.remove, { userId, toolkit: args.toolkit });
    return null;
  },
});
