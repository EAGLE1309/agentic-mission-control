import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import {
  MISSIONS_PER_USER_PER_DAY,
  OPENROUTER_BURST,
  OPENROUTER_DAILY_SAFETY,
  OPENROUTER_PER_MINUTE,
  SEARCH_PER_DAY,
} from "../src/shared/constants";

// Limits (tech spec §8). Fixed windows use start 0, so each day resets at
// 00:00 UTC and the UI can show the reset time.

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** Missions each user can start each day. MISSION_QUOTA overrides it (development). */
export const MISSION_QUOTA = positiveInt(process.env.MISSION_QUOTA, MISSIONS_PER_USER_PER_DAY);

/** MISSION_QUOTA=off turns the daily mission limit off, for a development deployment. */
export const MISSION_QUOTA_OFF = ["off", "none", "unlimited"].includes((process.env.MISSION_QUOTA ?? "").trim().toLowerCase());

/** OpenRouter calls each day for all users, minus the safety margin. */
export const DAILY_CALL_CAP = Math.floor(
  positiveInt(process.env.OPENROUTER_DAILY_CAP, 1000) * (1 - OPENROUTER_DAILY_SAFETY),
);

/**
 * Searches each day for all users, per search service. LINKUP_DAILY_CAP,
 * EXA_DAILY_CAP, and TAVILY_DAILY_CAP override them (a paid plan).
 */
export const SEARCH_DAILY_CAPS = {
  linkup: positiveInt(process.env.LINKUP_DAILY_CAP, SEARCH_PER_DAY.linkup),
  exa: positiveInt(process.env.EXA_DAILY_CAP, SEARCH_PER_DAY.exa),
  tavily: positiveInt(process.env.TAVILY_DAILY_CAP, SEARCH_PER_DAY.tavily),
};

export const limits = new RateLimiter(components.rateLimiter, {
  missionsPerUser: { kind: "fixed window", rate: MISSION_QUOTA, period: DAY, start: 0 },
  openrouterDay: { kind: "fixed window", rate: DAILY_CALL_CAP, period: DAY, start: 0 },
  openrouterMinute: {
    kind: "token bucket",
    rate: OPENROUTER_PER_MINUTE,
    period: MINUTE,
    capacity: OPENROUTER_BURST,
  },
  linkupDay: { kind: "fixed window", rate: SEARCH_DAILY_CAPS.linkup, period: DAY, start: 0 },
  exaDay: { kind: "fixed window", rate: SEARCH_DAILY_CAPS.exa, period: DAY, start: 0 },
  tavilyDay: { kind: "fixed window", rate: SEARCH_DAILY_CAPS.tavily, period: DAY, start: 0 },
});

/** Start of the next UTC day after `ts`. */
export function nextUtcDay(ts: number): number {
  return (Math.floor(ts / DAY) + 1) * DAY;
}
