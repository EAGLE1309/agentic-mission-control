/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import workflow from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MISSION_CALL_BUDGET } from "../src/shared/constants";

export const modules = import.meta.glob("./**/*.ts");

export function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  workflow.register(t);
  return t;
}

export type TestConvex = ReturnType<typeof setup>;

export const ALICE = { subject: "alice", issuer: "https://test", tokenIdentifier: "https://test|alice", name: "Alice" };
export const BOB = { subject: "bob", issuer: "https://test", tokenIdentifier: "https://test|bob", name: "Bob" };

/** Insert a queued mission for a user and return its ID. */
export async function seedMission(t: TestConvex, userId = ALICE.tokenIdentifier): Promise<Id<"missions">> {
  return await t.run((ctx) =>
    ctx.db.insert("missions", {
      userId,
      goal: "Compare three vector databases",
      status: "queued",
      partial: false,
      modelProfile: "balanced",
      mode: "simulated",
      lastSeq: 0,
      stopRequested: false,
      stats: { calls: 0, tokens: 0 },
      budget: MISSION_CALL_BUDGET,
      callsReserved: 0,
      revisionCount: 0,
      lastActivityAt: Date.now(),
    }),
  );
}
