import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProfileCard } from "@/features/settings/profile-card";
import { SignOutButton } from "@/features/settings/sign-out-button";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-8 md:px-6">
        <Section title="Profile" description="Your name and avatar come from your sign-in method.">
          <ProfileCard />
        </Section>
        <Section title="Appearance" description="Choose a theme, or follow the setting of your system.">
          <div className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-foreground">Theme</span>
            <ThemeToggle className="sm:w-64" />
          </div>
        </Section>
        <Section title="Account" description="Sign out of Mission Control on this device.">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-card p-4 shadow-raised">
            <span className="text-sm text-foreground">Session</span>
            <SignOutButton />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-balance">{title}</h2>
        <p className="text-xs text-muted-foreground text-pretty">{description}</p>
      </div>
      {children}
    </section>
  );
}
