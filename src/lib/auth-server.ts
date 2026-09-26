import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

// Server-only helpers. The route handler forwards /api/auth/* to Convex.
export const { handler, getToken, isAuthenticated, preloadAuthQuery, fetchAuthQuery, fetchAuthMutation } =
  convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
  });
