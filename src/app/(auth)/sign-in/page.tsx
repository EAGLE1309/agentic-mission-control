import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { loadAuthPage } from "@/features/auth/load-auth-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Mission Control to open your missions.",
  // A sign-in form has nothing to rank for; the links on it still count.
  robots: { index: false, follow: true },
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, providers, oauthError } = await loadAuthPage(searchParams);
  return <AuthForm mode="sign-in" next={next} providers={providers} oauthError={oauthError} />;
}
