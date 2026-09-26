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
    expect(await t.withIdentity(ALICE).query(api.apps.connections, {})).toEqual([{ toolkit: "slack", connectedAt: 2, read: true, write: false }]);
    expect(await t.withIdentity(BOB).query(api.apps.connections, {})).toEqual([{ toolkit: "github", connectedAt: 1, read: true, write: false }]);

    await t.mutation(internal.apps.remove, { userId: BOB.tokenIdentifier, toolkit: "github" });
    expect(await t.withIdentity(BOB).query(api.apps.connections, {})).toEqual([]);
    await expect(t.query(api.apps.connections, {})).rejects.toThrow(/UNAUTHENTICATED/);
  });

  test("access: read is on and write is off at first; only the owner changes it, within what the app supports", async () => {
    const t = setup();
    await t.mutation(internal.apps.replace, {
      userId: ALICE.tokenIdentifier,
      connections: [
        { toolkit: "notion", connectedAccountId: "ca_1" },
        { toolkit: "dropbox", connectedAccountId: "ca_2" },
        { toolkit: "figma", connectedAccountId: "ca_3" },
      ],
      now: 1,
    });
    const alice = t.withIdentity(ALICE);
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "notion" })).toEqual({ read: true, write: false });

    await alice.mutation(api.apps.setAccess, { toolkit: "notion", read: true, write: true });
    // Dropbox has no create action, so write stays off.
    await alice.mutation(api.apps.setAccess, { toolkit: "dropbox", read: false, write: true });
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "notion" })).toEqual({ read: true, write: true });
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "dropbox" })).toEqual({ read: false, write: false });
    // Figma is connect only; Slack is not connected.
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "figma" })).toEqual({ read: false, write: false });
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "slack" })).toBeNull();

    // A sync keeps the choices of the user.
    await t.mutation(internal.apps.replace, {
      userId: ALICE.tokenIdentifier,
      connections: [{ toolkit: "notion", connectedAccountId: "ca_9" }],
      now: 2,
    });
    expect(await t.query(internal.apps.access, { userId: ALICE.tokenIdentifier, toolkit: "notion" })).toEqual({ read: true, write: true });

    await expect(t.withIdentity(BOB).mutation(api.apps.setAccess, { toolkit: "notion", read: false, write: false })).rejects.toThrow(/NOT_FOUND/);
    await expect(alice.mutation(api.apps.setAccess, { toolkit: "not-an-app", read: true, write: true })).rejects.toThrow(/INVALID_INPUT/);
  });
});
