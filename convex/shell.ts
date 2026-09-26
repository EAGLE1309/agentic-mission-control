import { DAY } from "@convex-dev/rate-limiter";
import { query } from "./_generated/server";
import { resolveMode } from "./engine/llm/client";
import { requireUser } from "./lib/auth";
import { limits } from "./limits";
import { ADMISSION_MIN_DAILY_CALLS } from "../src/shared/constants";

// Data for the sidebar, the command palette, and the composer banner
// (FR-5, FR-6, FR-9). Queries do not read the clock, so the window values go
// to the client, which applies the current time.

const RECENT = 20;

export type WindowValue = { value: number; windowStart: number; period: number; max: number };

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const unread = await ctx.db
      .query("inboxItems")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user.userId).eq("readAt", undefined))
      .take(100);

    const quota = await limits.getValue(ctx, "missionsPerUser", { key: user.userId });
    const capacity = resolveMode() === "live" ? await limits.getValue(ctx, "openrouterDay") : null;

    const recent = await ctx.db
      .query("missions")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .order("desc")
      .take(RECENT);

    // Live dots (FR-5): a role is active while a task with that role runs.
    const activeRoles = { orchestrator: 0, researcher: 0, writer: 0, assembler: 0 };
    for (const mission of recent) {
      if (mission.status === "planning") activeRoles.orchestrator += 1;
      if (mission.status === "assembling") activeRoles.assembler += 1;
      if (mission.status !== "running") continue;
      const nodes = await ctx.db
        .query("nodes")
        .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", mission._id))
        .take(100);
      const running = new Set(nodes.filter((node) => node.status === "running" || node.status === "queued").map((node) => node.role));
      if (running.has("researcher")) activeRoles.researcher += 1;
      if (running.has("writer")) activeRoles.writer += 1;
    }

    const window = (value: { value: number; ts: number; config: { rate: number; capacity?: number } }): WindowValue => ({
      value: value.value,
      windowStart: value.ts,
      period: DAY,
      max: value.config.capacity ?? value.config.rate,
    });

    return {
      unreadCount: unread.length,
      quota: window(quota),
      capacity: capacity ? { ...window(capacity), minimum: ADMISSION_MIN_DAILY_CALLS } : null,
      activeRoles,
      recentMissions: recent.slice(0, 5).map((mission) => ({ id: mission._id, title: mission.title ?? mission.goal })),
    };
  },
});
