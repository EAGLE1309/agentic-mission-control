import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { MAX_FOLLOW_UPS, MISSIONS_PER_USER_PER_DAY } from "../src/shared/constants";
import { ALICE, BOB, setup } from "./test.helpers";

// Fake timers keep the workflows from running: these tests cover the public
// API only. The engine runs on the dev deployment in simulated mode.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const goal = "Compare three open-source vector databases for a small RAG app";

describe("missions.create", () => {
  test("rejects an empty or long goal, and a signed-out user", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    await expect(alice.mutation(api.missions.create, { goal: "   ", modelProfile: "balanced" })).rejects.toThrow(
      /INVALID_INPUT/,
    );
    await expect(
      alice.mutation(api.missions.create, { goal: "x".repeat(4_001), modelProfile: "balanced" }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await expect(t.mutation(api.missions.create, { goal, modelProfile: "balanced" })).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("adds the mission, its first event, and a workflow", async () => {
    const t = setup();
    const missionId = await t.withIdentity(ALICE).mutation(api.missions.create, { goal: `  ${goal}  `, modelProfile: "fast" });

    const mission = await t.run((ctx) => ctx.db.get("missions", missionId));
    expect(mission).toMatchObject({
      userId: ALICE.tokenIdentifier,
      goal,
      status: "queued",
      mode: "simulated",
      modelProfile: "fast",
      lastSeq: 1,
    });
    expect(mission?.workflowId).toBeTypeOf("string");

    const events = await t.withIdentity(ALICE).query(api.events.page, { missionId, afterSeq: 0 });
    expect(events.map((event) => event.type)).toEqual(["mission_created"]);
  });

  test("enforces the daily quota for each user", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    for (let i = 0; i < MISSIONS_PER_USER_PER_DAY; i += 1) {
      await alice.mutation(api.missions.create, { goal, modelProfile: "balanced" });
    }
    await expect(alice.mutation(api.missions.create, { goal, modelProfile: "balanced" })).rejects.toThrow(
      /QUOTA_EXCEEDED/,
    );
    // The quota is per user, and a refused mission leaves no row.
    await expect(t.withIdentity(BOB).mutation(api.missions.create, { goal, modelProfile: "balanced" })).resolves.toBeTypeOf(
      "string",
    );
    const count = await t.run(async (ctx) => (await ctx.db.query("missions").take(10)).length);
    expect(count).toBe(MISSIONS_PER_USER_PER_DAY + 1);

    const summary = await alice.query(api.shell.summary, {});
    expect(summary.quota?.value).toBe(0);
  });
});

describe("missions.stop and missions.followUp", () => {
  test("stop ends an active mission once, for the owner only", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    const missionId = await alice.mutation(api.missions.create, { goal, modelProfile: "balanced" });

    await expect(t.withIdentity(BOB).mutation(api.missions.stop, { missionId })).rejects.toThrow(/NOT_FOUND/);
    await alice.mutation(api.missions.stop, { missionId });
    const mission = await alice.query(api.missions.get, { missionId });
    expect(mission.status).toBe("stopped");
    await expect(alice.mutation(api.missions.stop, { missionId })).rejects.toThrow(/MISSION_NOT_ACTIVE/);
  });

  test("a follow-up waits for the mission to end, then opens a turn with more budget", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    const missionId = await alice.mutation(api.missions.create, { goal, modelProfile: "balanced" });

    // Not while it runs, not empty, and not for another user.
    await expect(alice.mutation(api.missions.followUp, { missionId, message: "Retry the failed tasks." })).rejects.toThrow(/INVALID_INPUT/);
    await t.run((ctx) => ctx.db.patch("missions", missionId, { status: "failed", callsReserved: 60 }));
    await expect(alice.mutation(api.missions.followUp, { missionId, message: "   " })).rejects.toThrow(/INVALID_INPUT/);
    await expect(t.withIdentity(BOB).mutation(api.missions.followUp, { missionId, message: "Hi" })).rejects.toThrow(/NOT_FOUND/);

    // A failed mission can be driven again.
    await alice.mutation(api.missions.followUp, { missionId, message: "Retry the failed tasks." });
    const mission = await t.run((ctx) => ctx.db.get("missions", missionId));
    expect(mission).toMatchObject({ status: "planning", revisionCount: 1, budget: 100 });
    const events = await alice.query(api.events.page, { missionId, afterSeq: 1 });
    expect(events.map((event) => event.type)).toEqual(["revision_requested", "nodes_added", "mission_status"]);

    await t.run((ctx) => ctx.db.patch("missions", missionId, { status: "completed", revisionCount: MAX_FOLLOW_UPS }));
    await expect(alice.mutation(api.missions.followUp, { missionId, message: "One more." })).rejects.toThrow(/follow-ups/);
  });

  test("get gives NOT_FOUND for a malformed ID", async () => {
    const t = setup();
    await expect(t.withIdentity(ALICE).query(api.missions.get, { missionId: "not-an-id" })).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("lists, inbox, and usage", () => {
  test("list shows only the owner's missions and applies the status filter", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    const first = await alice.mutation(api.missions.create, { goal, modelProfile: "balanced" });
    const second = await alice.mutation(api.missions.create, { goal: "Summarize recent news on AI agents", modelProfile: "fast" });
    await t.withIdentity(BOB).mutation(api.missions.create, { goal, modelProfile: "balanced" });
    await t.run((ctx) => ctx.db.patch("missions", second, { status: "completed", partial: true }));

    const all = await alice.query(api.missions.list, { paginationOpts: { numItems: 10, cursor: null }, status: "all" });
    expect(all.page.map((row) => row._id)).toEqual([second, first]);
    const partial = await alice.query(api.missions.list, { paginationOpts: { numItems: 10, cursor: null }, status: "partial" });
    expect(partial.page.map((row) => row._id)).toEqual([second]);
    const running = await alice.query(api.missions.list, { paginationOpts: { numItems: 10, cursor: null }, status: "running" });
    expect(running.page.map((row) => row._id)).toEqual([first]);

    const usage = await alice.query(api.usage.summary, {});
    expect(usage.missions).toBe(2);
  });

  test("inbox items are private, and reading them updates the unread count", async () => {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    const missionId = await alice.mutation(api.missions.create, { goal, modelProfile: "balanced" });
    const itemId = await t.run((ctx) =>
      ctx.db.insert("inboxItems", { userId: ALICE.tokenIdentifier, kind: "mission_completed", missionId }),
    );

    expect((await alice.query(api.shell.summary, {})).unreadCount).toBe(1);
    await expect(t.withIdentity(BOB).mutation(api.inbox.markRead, { itemId })).rejects.toThrow(/NOT_FOUND/);
    const unread = await alice.query(api.inbox.list, { paginationOpts: { numItems: 10, cursor: null }, unreadOnly: true });
    expect(unread.page).toHaveLength(1);

    await alice.mutation(api.inbox.markRead, { itemId });
    expect((await alice.query(api.shell.summary, {})).unreadCount).toBe(0);
    const bobInbox = await t.withIdentity(BOB).query(api.inbox.list, { paginationOpts: { numItems: 10, cursor: null }, unreadOnly: false });
    expect(bobInbox.page).toHaveLength(0);
  });
});
