import { describe, expect, test } from "vitest";
import { internal, api } from "./_generated/api";
import type { EventInput } from "../src/shared/events";
import { ALICE, BOB, seedMission, setup } from "./test.helpers";

const created: EventInput = {
  type: "mission_created",
  payload: { goal: "Compare three vector databases", modelProfile: "balanced", mode: "simulated" },
};

const plan: EventInput = {
  type: "plan_created",
  nodeId: "orchestrator",
  payload: {
    title: "Vector databases",
    rationale: "Research each option, then compare.",
    nodes: [
      { id: "pricing", role: "researcher", title: "Pricing", instructions: "Find prices.", dependsOn: [] },
      { id: "features", role: "researcher", title: "Features", instructions: "Find features.", dependsOn: [] },
      { id: "compare", role: "writer", title: "Compare", instructions: "Compare.", dependsOn: ["pricing", "features"] },
    ],
  },
};

describe("appendEvents", () => {
  test("gives dense seq numbers across calls and updates the mission", async () => {
    const t = setup();
    const missionId = await seedMission(t);

    const first = await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [created, { type: "mission_status", payload: { status: "planning" } }],
    });
    const second = await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [
        { type: "llm_usage", nodeId: "orchestrator", payload: { model: "m", inputTokens: 100, outputTokens: 20, latencyMs: 900 } },
        plan,
      ],
    });

    expect(first).toBe(2);
    expect(second).toBe(4);
    const rows = await t.run((ctx) => ctx.db.query("events").collect());
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4]);

    const mission = await t.run((ctx) => ctx.db.get("missions", missionId));
    expect(mission).toMatchObject({ lastSeq: 4, status: "planning", title: "Vector databases", stats: { calls: 1, tokens: 120 } });
  });

  test("keeps node rows in step with node events, and kills open nodes on stop", async () => {
    const t = setup();
    const missionId = await seedMission(t);

    await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [
        created,
        plan,
        { type: "mission_status", payload: { status: "running" } },
        { type: "node_started", nodeId: "pricing", payload: { attempt: 1, model: "m" } },
        { type: "node_done", nodeId: "pricing", payload: { summary: "Done.", sources: [] } },
        { type: "node_started", nodeId: "features", payload: { attempt: 1, model: "m" } },
        { type: "mission_stopped", payload: { by: "user" } },
      ],
    });

    const nodes = await t.run((ctx) => ctx.db.query("nodes").collect());
    const statusOf = Object.fromEntries(nodes.map((node) => [node.nodeId, node.status]));
    expect(statusOf).toEqual({ pricing: "done", features: "killed", compare: "killed" });

    const mission = await t.run((ctx) => ctx.db.get("missions", missionId));
    expect(mission?.status).toBe("stopped");
    expect(mission?.endedAt).toBeTypeOf("number");
  });

  test("drops task events that arrive after the mission ended", async () => {
    const t = setup();
    const missionId = await seedMission(t);

    await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [created, plan, { type: "mission_stopped", payload: { by: "user" } }],
    });
    const lastSeq = await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [{ type: "node_done", nodeId: "pricing", payload: { summary: "Late.", sources: [] } }],
    });

    expect(lastSeq).toBe(3);
    const pricing = await t.run((ctx) =>
      ctx.db
        .query("nodes")
        .withIndex("by_missionId_and_nodeId", (q) => q.eq("missionId", missionId).eq("nodeId", "pricing"))
        .unique(),
    );
    expect(pricing?.status).toBe("killed");
  });

  test("rejects a plan with a cycle", async () => {
    const t = setup();
    const missionId = await seedMission(t);

    await expect(
      t.mutation(internal.events.appendEvents, {
        missionId,
        events: [
          {
            type: "plan_created",
            payload: {
              title: "Loop",
              rationale: "",
              nodes: [
                { id: "a", role: "researcher", title: "A", instructions: "A", dependsOn: ["b"] },
                { id: "b", role: "researcher", title: "B", instructions: "B", dependsOn: ["a"] },
              ],
            },
          },
        ],
      }),
    ).rejects.toThrow(/cycle/);

    const rows = await t.run((ctx) => ctx.db.query("events").collect());
    expect(rows).toHaveLength(0);
  });
});

describe("page and tail", () => {
  test("return only events after afterSeq, for the owner only", async () => {
    const t = setup();
    const missionId = await seedMission(t);
    await t.mutation(internal.events.appendEvents, {
      missionId,
      events: [created, { type: "mission_status", payload: { status: "planning" } }, plan],
    });

    const alice = t.withIdentity(ALICE);
    const page = await alice.query(api.events.page, { missionId, afterSeq: 0 });
    const tail = await alice.query(api.events.tail, { missionId, afterSeq: 2 });
    expect(page.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(tail.map((event) => event.type)).toEqual(["plan_created"]);

    await expect(t.withIdentity(BOB).query(api.events.tail, { missionId, afterSeq: 0 })).rejects.toThrow(/NOT_FOUND/);
    await expect(t.query(api.events.tail, { missionId, afterSeq: 0 })).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("artifacts are owner only and cut at the size limit", async () => {
    const t = setup();
    const missionId = await seedMission(t);
    const artifactId = await t.mutation(internal.artifacts.create, {
      missionId,
      kind: "tool_output",
      text: "x".repeat(200_010),
    });

    const artifact = await t.withIdentity(ALICE).query(api.artifacts.get, { artifactId });
    expect(artifact.text).toHaveLength(200_000);
    expect(artifact.truncated).toBe(true);
    await expect(t.withIdentity(BOB).query(api.artifacts.get, { artifactId })).rejects.toThrow(/NOT_FOUND/);
  });
});
