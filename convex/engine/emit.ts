import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { PREVIEW_MAX_CHARS } from "../../src/shared/constants";
import { preview, type EventInput } from "../../src/shared/events";
import type { ArtifactKind } from "../artifacts";

// Helpers for engine actions. Actions write only through appendEvents.

export async function emit(ctx: ActionCtx, missionId: Id<"missions">, events: EventInput[]): Promise<number> {
  return await ctx.runMutation(internal.events.appendEvents, { missionId, events });
}

export async function saveArtifact(
  ctx: ActionCtx,
  args: { missionId: Id<"missions">; nodeId?: string; kind: ArtifactKind; text: string },
): Promise<Id<"artifacts">> {
  return await ctx.runMutation(internal.artifacts.create, args);
}

/**
 * A preview for an event, and an artifact with the full text when the text is
 * longer than the preview (tech spec §3.1 rule 5).
 */
export async function previewWithArtifact(
  ctx: ActionCtx,
  args: { missionId: Id<"missions">; nodeId: string; kind: ArtifactKind; text: string },
): Promise<{ preview: string; artifactId: Id<"artifacts"> | undefined }> {
  if (args.text.length <= PREVIEW_MAX_CHARS) return { preview: args.text, artifactId: undefined };
  const artifactId = await saveArtifact(ctx, args);
  return { preview: preview(args.text), artifactId };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error.";
}
