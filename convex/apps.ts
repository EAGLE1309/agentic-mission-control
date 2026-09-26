import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { appSpec, isAppSlug, usableApps, type UsableApp } from "../src/shared/apps";
import { appError } from "../src/shared/errors";

// Connected third-party apps (design §6.8). composio.ts talks to Composio;
// these functions keep the copy that the Integrations page reads.

const MAX_CONNECTIONS = 100;

/** The apps the user connected, for the Integrations page. */
export const connections = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx);
    const rows = await ctx.db
      .query("appConnections")
      .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", userId))
      .take(MAX_CONNECTIONS);
    return rows.map((row) => ({
      toolkit: row.toolkit,
      connectedAt: row.connectedAt,
      read: row.read ?? true,
      write: row.write ?? false,
    }));
  },
});

/**
 * Turn search (read) and creating items (write) on or off for one connected
 * app. An app without the ability keeps it off.
 */
export const setAccess = mutation({
  args: { toolkit: v.string(), read: v.boolean(), write: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    if (!isAppSlug(args.toolkit)) throw appError("INVALID_INPUT", { message: "This app is not in the list." });
    const spec = appSpec(args.toolkit);
    const row = await ctx.db
      .query("appConnections")
      .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", userId).eq("toolkit", args.toolkit))
      .first();
    if (!row) throw appError("NOT_FOUND");
    await ctx.db.patch("appConnections", row._id, {
      read: spec.search && args.read,
      write: spec.write !== undefined && args.write,
    });
  },
});

/** The apps that agents may use for one user, with read and write. */
export async function usableAppsFor(ctx: Pick<QueryCtx, "db">, userId: string): Promise<UsableApp[]> {
  const rows = await ctx.db
    .query("appConnections")
    .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", userId))
    .take(MAX_CONNECTIONS);
  return usableApps(rows);
}

/** The current access of one app, for the check at call time. null when it is not connected. */
export const access = internalQuery({
  args: { userId: v.string(), toolkit: v.string() },
  handler: async (ctx, args): Promise<{ read: boolean; write: boolean } | null> => {
    const apps = await usableAppsFor(ctx, args.userId);
    const app = apps.find((item) => item.slug === args.toolkit);
    if (app) return { read: app.read, write: app.write };
    const row = await ctx.db
      .query("appConnections")
      .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", args.userId).eq("toolkit", args.toolkit))
      .first();
    return row ? { read: false, write: false } : null;
  },
});

/** Make the rows of a user match the active Composio connections. */
export const replace = internalMutation({
  args: {
    userId: v.string(),
    connections: v.array(v.object({ toolkit: v.string(), connectedAccountId: v.string() })),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("appConnections")
      .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", args.userId))
      .take(MAX_CONNECTIONS);
    const next = new Map(args.connections.map((item) => [item.toolkit, item]));
    for (const row of rows) {
      const match = next.get(row.toolkit);
      if (!match) {
        await ctx.db.delete("appConnections", row._id);
        continue;
      }
      if (match.connectedAccountId !== row.connectedAccountId) {
        await ctx.db.patch("appConnections", row._id, { connectedAccountId: match.connectedAccountId, connectedAt: args.now });
      }
      next.delete(row.toolkit);
    }
    for (const item of next.values()) {
      await ctx.db.insert("appConnections", { userId: args.userId, ...item, connectedAt: args.now });
    }
  },
});

/** Remove one app of a user after it is disconnected in Composio. */
export const remove = internalMutation({
  args: { userId: v.string(), toolkit: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("appConnections")
      .withIndex("by_userId_and_toolkit", (q) => q.eq("userId", args.userId).eq("toolkit", args.toolkit))
      .take(MAX_CONNECTIONS);
    for (const row of rows) await ctx.db.delete("appConnections", row._id);
  },
});
