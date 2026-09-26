import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../src/shared/constants";

// Better Auth runs inside Convex (tech spec §10). Next.js forwards
// /api/auth/* here through src/app/api/auth/[...all]/route.ts.

export const authComponent = createClient<DataModel>(components.betterAuth);

export function configuredSocialProviders() {
  const github =
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
      : undefined;
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
        }
      : undefined;
  return { github, google };
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  const { github, google } = configuredSocialProviders();
  const options = {
    baseURL: siteUrl,
    trustedOrigins: siteUrl ? [siteUrl] : [],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    socialProviders: {
      ...(github ? { github } : {}),
      ...(google ? { google } : {}),
    },
    account: {
      // GitHub and Google verify emails, so an OAuth sign-in with the same
      // email joins the existing account instead of failing.
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
  return betterAuth(options);
};

/** The profile for the user menu and settings (FR-4), or null when signed out. */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    return { name: user.name, email: user.email, image: user.image ?? null };
  },
});

/** Which OAuth providers have keys. The auth screens show only these buttons. */
export const socialProviders = query({
  args: {},
  handler: async () => {
    const { github, google } = configuredSocialProviders();
    return { github: github !== undefined, google: google !== undefined };
  },
});
