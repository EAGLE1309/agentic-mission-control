"use node";

import { Composio } from "@composio/core";
import { createHash } from "node:crypto";
import { appError } from "../../src/shared/errors";

// Shared Composio helpers for the Node actions (design §6.8).

/** The Composio user ID of an app user: an opaque key, not the auth issuer or the user ID. */
export function composioUserIdFor(userId: string): string {
  return `mc_${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;
}

/** The Composio client. The key stays in the Convex environment. */
export function composioClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw appError("APP_NOT_CONFIGURED");
  return new Composio({ apiKey, allowTracking: false });
}
