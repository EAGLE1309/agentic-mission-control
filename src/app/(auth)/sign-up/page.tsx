import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { loadAuthPage } from "@/features/auth/load-auth-page";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next, providers, oauthError } = await loadAuthPage(searchParams);
  return <AuthForm mode="sign-up" next={next} providers={providers} oauthError={oauthError} />;
}
