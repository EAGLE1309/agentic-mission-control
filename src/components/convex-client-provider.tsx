"use client";

import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

// The component's AuthClient type infers the session as `never` with
// better-auth 1.6.33. The runtime object is the same, so cast once here.
const providerAuthClient = authClient as unknown as AuthClient;

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  // Queries wait for the auth token, so no query runs signed out by mistake.
  expectAuth: true,
});

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={providerAuthClient} initialToken={initialToken}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
