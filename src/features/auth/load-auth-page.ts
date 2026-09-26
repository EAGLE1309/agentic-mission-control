import { api } from "@convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { safeNextPath } from "@/lib/safe-next";
import type { SocialProviders } from "./auth-form";

const NO_PROVIDERS: SocialProviders = { github: false, google: false };

/**
 * Shared server logic of the sign-in and sign-up pages: a signed-in user goes
 * to `next`. A failed check counts as signed out, so the form still shows.
 */
export async function loadAuthPage(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const oauthError = typeof params.error === "string" ? params.error : null;

  let signedIn = false;
  try {
    signedIn = await isAuthenticated();
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect(next);

  const providers = await fetchQuery(api.auth.socialProviders, {}).catch(() => NO_PROVIDERS);
  return { next, providers, oauthError };
}
