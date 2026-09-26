import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getOwnedMission, requireUser } from "./lib/auth";

// Live thoughts (tech spec §5.1 nodeLive). Workers write 4 times each second
// or less. Replay does not use them.

export const LIVE_MAX_CHARS = 240;

export const set = internalMutation({
  args: { missionId: v.id("missions"), nodeId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const text = args.text.slice(-LIVE_MAX_CHARS);
    const row = await ctx.db
      .query("nodeLive")
      .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", args.missionId).eq("nodeId", args.nodeId))
      .unique();
    if (row) {
      if (row.text !== text) await ctx.db.patch("nodeLive", row._id, { text, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("nodeLive", { missionId: args.missionId, nodeId: args.nodeId, text, updatedAt: Date.now() });
    }
  },
});

/** The live thought of each task of a mission. Owner only. */
export const forMission = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await getOwnedMission(ctx, args.missionId, user.userId);
    const rows = await ctx.db
      .query("nodeLive")
      .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", args.missionId))
      .take(100);
    return rows.map((row) => ({ nodeId: row.nodeId, text: row.text, updatedAt: row.updatedAt }));
  },
});
