import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";

/** All-time totals for the Usage page (FR-28). Today's quota comes from shell.summary. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("userStats")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique();
    return { missions: row?.missions ?? 0, tokens: row?.tokens ?? 0 };
  },
});
