import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

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
    return rows.map((row) => ({ toolkit: row.toolkit, connectedAt: row.connectedAt }));
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
