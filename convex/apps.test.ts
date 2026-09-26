import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { ALICE, BOB, setup } from "./test.helpers";

describe("app connections", () => {
  test("a sync replaces the rows of one user, and each user sees only their own", async () => {
    const t = setup();
    await t.mutation(internal.apps.replace, {
      userId: ALICE.tokenIdentifier,
      connections: [
        { toolkit: "slack", connectedAccountId: "ca_1" },
        { toolkit: "notion", connectedAccountId: "ca_2" },
      ],
      now: 1,
    });
    await t.mutation(internal.apps.replace, {
      userId: BOB.tokenIdentifier,
      connections: [{ toolkit: "github", connectedAccountId: "ca_3" }],
      now: 1,
    });

    // A later sync drops Notion and moves Slack to a new account.
    await t.mutation(internal.apps.replace, {
      userId: ALICE.tokenIdentifier,
      connections: [{ toolkit: "slack", connectedAccountId: "ca_4" }],
      now: 2,
    });
    expect(await t.withIdentity(ALICE).query(api.apps.connections, {})).toEqual([{ toolkit: "slack", connectedAt: 2 }]);
    expect(await t.withIdentity(BOB).query(api.apps.connections, {})).toEqual([{ toolkit: "github", connectedAt: 1 }]);

    await t.mutation(internal.apps.remove, { userId: BOB.tokenIdentifier, toolkit: "github" });
    expect(await t.withIdentity(BOB).query(api.apps.connections, {})).toEqual([]);
    await expect(t.query(api.apps.connections, {})).rejects.toThrow(/UNAUTHENTICATED/);
  });
});
