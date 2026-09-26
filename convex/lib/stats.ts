import type { MutationCtx } from "../_generated/server";

/** Add to the all-time totals of a user (FR-28). Call it inside the mutation that changes the source rows. */
export async function addUserStats(ctx: MutationCtx, userId: string, delta: { missions?: number; tokens?: number }) {
  const missions = delta.missions ?? 0;
  const tokens = delta.tokens ?? 0;
  if (missions === 0 && tokens === 0) return;
  const row = await ctx.db
    .query("userStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (row) {
    await ctx.db.patch("userStats", row._id, { missions: row.missions + missions, tokens: row.tokens + tokens });
  } else {
    await ctx.db.insert("userStats", { userId, missions, tokens });
  }
}
