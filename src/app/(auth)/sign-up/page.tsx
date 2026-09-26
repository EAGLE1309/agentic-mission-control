import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { loadAuthPage } from "@/features/auth/load-auth-page";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free Mission Control account. Give AI agents a goal, and watch them plan, research, and write a report.",
  alternates: { canonical: "/sign-up" },
};

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next, providers, oauthError } = await loadAuthPage(searchParams);
  return <AuthForm mode="sign-up" next={next} providers={providers} oauthError={oauthError} />;
}
