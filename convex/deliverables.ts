import { v } from "convex/values";
import { query } from "./_generated/server";
import { getOwnedMission, requireUser } from "./lib/auth";
import { MAX_FOLLOW_UPS } from "../src/shared/constants";

// Report versions (FR-24, FR-25). Owner only.

export const versions = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await getOwnedMission(ctx, args.missionId, user.userId);
    const rows = await ctx.db
      .query("deliverables")
      .withIndex("by_missionId_and_version", (q) => q.eq("missionId", args.missionId))
      .take(MAX_FOLLOW_UPS + 1);
    return rows.map((row) => ({
      version: row.version,
      instruction: row.instruction ?? null,
      words: row.words,
      sourceCount: row.sources.length,
      createdAt: row._creationTime,
    }));
  },
});

export const get = query({
  args: { missionId: v.id("missions"), version: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await getOwnedMission(ctx, args.missionId, user.userId);
    const row = await ctx.db
      .query("deliverables")
      .withIndex("by_missionId_and_version", (q) => q.eq("missionId", args.missionId).eq("version", args.version))
      .unique();
    if (!row) return null;
    return {
      version: row.version,
      markdown: row.markdown,
      sources: row.sources,
      words: row.words,
      instruction: row.instruction ?? null,
      createdAt: row._creationTime,
    };
  },
});
