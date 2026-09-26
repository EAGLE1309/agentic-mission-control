import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { appError } from "../src/shared/errors";

// The Inbox (FR-27): a notification when a mission completes or fails.

const MARK_ALL_BATCH = 500;

async function itemRow(ctx: QueryCtx, item: Doc<"inboxItems">) {
  const mission = await ctx.db.get("missions", item.missionId);
  return {
    _id: item._id,
    kind: item.kind,
    missionId: item.missionId,
    title: mission?.title ?? mission?.goal ?? "Deleted mission",
    status: mission?.status ?? null,
    partial: mission?.partial ?? false,
    readAt: item.readAt ?? null,
    createdAt: item._creationTime,
  };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, unreadOnly: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const result = args.unreadOnly
      ? await ctx.db
          .query("inboxItems")
          .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user.userId).eq("readAt", undefined))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("inboxItems")
          .withIndex("by_userId", (q) => q.eq("userId", user.userId))
          .order("desc")
          .paginate(args.paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((item) => itemRow(ctx, item))) };
  },
});

/** The newest item, for the finish toast (design §5.7). */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const item = await ctx.db
      .query("inboxItems")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .order("desc")
      .first();
    return item ? await itemRow(ctx, item) : null;
  },
});

export const markRead = mutation({
  args: { itemId: v.id("inboxItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get("inboxItems", args.itemId);
    if (!item || item.userId !== user.userId) throw appError("NOT_FOUND");
    if (item.readAt === undefined) await ctx.db.patch("inboxItems", item._id, { readAt: Date.now() });
  },
});

/** Mark each unread item read, and each unread item of one mission when missionId is set. */
export const markAllRead = mutation({
  args: { missionId: v.optional(v.id("missions")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("inboxItems")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user.userId).eq("readAt", undefined))
      .take(MARK_ALL_BATCH);
    const now = Date.now();
    for (const item of unread) {
      if (args.missionId && item.missionId !== args.missionId) continue;
      await ctx.db.patch("inboxItems", item._id, { readAt: now });
    }
  },
});
