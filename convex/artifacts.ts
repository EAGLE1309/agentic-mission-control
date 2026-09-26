import { v, type Infer } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ARTIFACT_MAX_CHARS } from "../src/shared/constants";
import { appError } from "../src/shared/errors";
import { getOwnedMission, requireUser } from "./lib/auth";
import { artifactKind } from "./schema";

export type ArtifactKind = Infer<typeof artifactKind>;

/** Save a full text. Texts over 200,000 characters are cut and marked truncated. */
export async function createArtifactTx(
  ctx: MutationCtx,
  args: { missionId: Id<"missions">; nodeId?: string; kind: ArtifactKind; text: string },
): Promise<Id<"artifacts">> {
  const truncated = args.text.length > ARTIFACT_MAX_CHARS;
  return await ctx.db.insert("artifacts", {
    missionId: args.missionId,
    ...(args.nodeId === undefined ? {} : { nodeId: args.nodeId }),
    kind: args.kind,
    text: truncated ? args.text.slice(0, ARTIFACT_MAX_CHARS) : args.text,
    truncated,
  });
}

export const create = internalMutation({
  args: {
    missionId: v.id("missions"),
    nodeId: v.optional(v.string()),
    kind: artifactKind,
    text: v.string(),
  },
  handler: (ctx, args) => createArtifactTx(ctx, args),
});

/** The full output for the trace panel ("Show full output"). Owner only. */
export const get = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const artifact = await ctx.db.get("artifacts", args.artifactId);
    if (!artifact) throw appError("NOT_FOUND");
    await getOwnedMission(ctx, artifact.missionId, user.userId);
    return {
      _id: artifact._id,
      kind: artifact.kind,
      nodeId: artifact.nodeId ?? null,
      text: artifact.text,
      truncated: artifact.truncated,
    };
  },
});
