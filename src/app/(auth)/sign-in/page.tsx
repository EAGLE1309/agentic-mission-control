import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { loadAuthPage } from "@/features/auth/load-auth-page";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, providers, oauthError } = await loadAuthPage(searchParams);
  return <AuthForm mode="sign-in" next={next} providers={providers} oauthError={oauthError} />;
}
