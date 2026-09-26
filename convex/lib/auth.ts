import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "../../src/shared/errors";

export type AppUser = {
  /** identity.tokenIdentifier. The ownership key of all app tables. */
  userId: string;
  name: string | null;
  email: string | null;
  pictureUrl: string | null;
};

/** The signed-in user, or UNAUTHENTICATED. Every public function calls this. */
export async function requireUser(ctx: Pick<QueryCtx, "auth">): Promise<AppUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw appError("UNAUTHENTICATED");
  return {
    userId: identity.tokenIdentifier,
    name: identity.name ?? null,
    email: identity.email ?? null,
    pictureUrl: identity.pictureUrl ?? null,
  };
}

/**
 * The mission if the user owns it. A missing mission and a mission of a
 * different user both give NOT_FOUND, so IDs do not leak (tech spec §10).
 */
export async function getOwnedMission(ctx: Pick<QueryCtx, "db">, missionId: Id<"missions">, userId: string) {
  const mission = await ctx.db.get("missions", missionId);
  if (!mission || mission.userId !== userId) throw appError("NOT_FOUND");
  return mission;
}
