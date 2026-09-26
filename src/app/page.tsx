import { IconArrowRight, IconDeviceFloppy, IconPencil, IconPlus, IconRefresh, IconTemplate } from "@tabler/icons-react";
import { getSessionCookie } from "better-auth/cookies";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { AgentRoster } from "@/features/landing/agent-roster";
import { AppsPanels, StackLine } from "@/features/landing/apps-section";
import { BlurInText, blurIn } from "@/features/landing/blur-in-text";
import { HowItWorks } from "@/features/landing/how-it-works";
import { FollowUpIllustration, TraceIllustration } from "@/features/landing/illustrations";
import { LandingDemo } from "@/features/landing/landing-demo";
import { Reveal } from "@/features/landing/reveal";
import { DEFAULT_APP_PATH } from "@/lib/safe-next";
import { SITE_TITLE } from "@/lib/site";
import { TEMPLATES } from "@/shared/templates";

// Landing (FR-1, design §6.12). The hero blurs in once on load; a few blocks
// blur in once as they scroll into view. The recorded demo is the hero.

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#agents", label: "Agents" },
  { href: "#integrations", label: "Integrations" },
] as const;

const FOLLOW_UPS = [
  { icon: IconRefresh, label: "Rerun a task" },
  { icon: IconPlus, label: "Add a task" },
  { icon: IconPencil, label: "Revise the report" },
  { icon: IconDeviceFloppy, label: "Save it to an app" },
] as const;

/** A template link: sign-up returns to the composer with the template in it. */
function templateHref(id: string, signedIn: boolean) {
  const path = `${DEFAULT_APP_PATH}?template=${id}`;
  return signedIn ? path : `/sign-up?next=${encodeURIComponent(path)}`;
}

function SectionHeading({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h2 id={id} className="scroll-mt-24 text-3xl leading-[1.1] font-semibold tracking-[-0.025em] text-balance md:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-relaxed text-pretty text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function LandingPage() {
  // Optimistic, like proxy.ts: the cookie only picks the CTA. The app checks the session.
  const signedIn = Boolean(getSessionCookie(await headers()));
  const startHref = signedIn ? DEFAULT_APP_PATH : "/sign-up";

  // Always dark (theme-provider.tsx). The class also covers the first paint of a client navigation.
  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground">
      <header className="landing-header sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
          <Link href="/" className="flex h-9 items-center gap-2 rounded-md pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Mark className="text-foreground" />
            <span className="text-sm font-semibold">Mission Control</span>
          </Link>
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex h-8 items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Button size="sm" render={<Link href={DEFAULT_APP_PATH} />}>
                Open app
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
                  Sign in
                </Button>
                <Button size="sm" render={<Link href="/sign-up" />}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 md:px-6">
        {/* Hero */}
        <section className="flex flex-col items-start gap-6 pt-16 pb-12 md:pt-28 md:pb-16">
          <h1 className="max-w-4xl text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl md:text-7xl">
            <BlurInText text="Give it a goal." />
            <br />
            <BlurInText text="Watch the agents work." delay={210} className="text-muted-foreground" />
          </h1>
          <p className="blur-in max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground" style={blurIn(420)}>
            An orchestrator splits your goal into tasks. Agents research in parallel, and you see every search, page, and
            draft. Then you get a report with sources.
          </p>
          <div className="blur-in flex flex-wrap items-center gap-2" style={blurIn(520)}>
            <Button size="lg" className="px-4 has-data-[icon=inline-end]:pr-3.5" render={<Link href={startHref} />}>
              Start a mission
              <IconArrowRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="ghost" className="px-4" render={<a href="#how-it-works" />}>
              See how it works
            </Button>
          </div>
        </section>

        {/* The recorded demo */}
        <div className="blur-in flex flex-col gap-3" style={blurIn(640, { y: 24, blur: 8, duration: 1000 })}>
          <div className="rounded-[24px] bg-muted/60 p-1.5 shadow-raised">
            <LandingDemo />
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            A recorded mission, played on the same graph and stream that the app uses.
          </p>
        </div>

        {/* How it works */}
        <section aria-labelledby="how-it-works" className="flex flex-col gap-12 pt-28 md:pt-36">
          <Reveal>
            <SectionHeading id="how-it-works" title="Three steps. You see all of them.">
              Most agent tools show a spinner until the answer arrives. Here, the work between the goal and the report
              happens in the open.
            </SectionHeading>
          </Reveal>
          <Reveal delay={120}>
            <HowItWorks />
          </Reveal>
        </section>

        {/* Agents */}
        <section aria-labelledby="agents" className="pt-28 md:pt-36">
          <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
            <Reveal className="md:sticky md:top-28 md:self-start">
              <SectionHeading id="agents" title="Five agents. One job each.">
                Each agent gets a clear task and only the tools it needs. Open any of them to read what it did.
              </SectionHeading>
            </Reveal>
            <Reveal delay={120}>
              <AgentRoster />
            </Reveal>
          </div>
        </section>

        {/* Trace */}
        <section aria-labelledby="trace" className="flex flex-col gap-12 pt-28 md:pt-36">
          <Reveal>
            <SectionHeading id="trace" title="Click a task. Read its trace.">
              Each thought, search, and page read, in order, with the model, the time, and the tokens. When a task fails,
              you see why, and you can retry only that task.
            </SectionHeading>
          </Reveal>
          <Reveal delay={120}>
            <TraceIllustration />
          </Reveal>
        </section>

        {/* Follow-ups */}
        <section aria-labelledby="follow-ups" className="pt-28 md:pt-36">
          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-16">
            <Reveal delay={120} className="md:order-last">
              <div className="flex flex-col gap-8">
                <SectionHeading id="follow-ups" title="Not quite right? Say so.">
                  Ask in the chat. The orchestrator changes the plan, and each change makes a new report version. The
                  old versions stay.
                </SectionHeading>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-foreground">
                  {FOLLOW_UPS.map((item) => (
                    <li key={item.label} className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card shadow-raised">
                        <item.icon aria-hidden className="size-4 text-muted-foreground" />
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal>
              <FollowUpIllustration />
            </Reveal>
          </div>
        </section>

        {/* Integrations */}
        <section aria-labelledby="integrations" className="flex flex-col gap-12 pt-28 md:pt-36">
          <Reveal>
            <SectionHeading id="integrations" title="Your apps are sources, too.">
              Connect an app, and the Librarian searches it next to the web. It can also create new items, but only
              where you turn on Write. It never edits or deletes.
            </SectionHeading>
          </Reveal>
          <Reveal delay={120} className="flex flex-col gap-8">
            <AppsPanels />
            <StackLine />
          </Reveal>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="start" className="pt-28 pb-20 md:pt-36 md:pb-28">
          <Reveal>
            <div className="flex flex-col items-start gap-8 rounded-3xl bg-card px-6 py-12 sm:px-12 sm:py-16">
              <div className="flex max-w-xl flex-col gap-3">
                <h2 id="start" className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">
                  Give it a goal.
                </h2>
                <p className="text-base leading-relaxed text-pretty text-muted-foreground">
                  Write your own, or start from one of these.
                </p>
              </div>
              <ul className="flex max-w-3xl flex-wrap gap-2">
                {TEMPLATES.map((template) => (
                  <li key={template.id}>
                    <Link
                      href={templateHref(template.id, signedIn)}
                      className="flex h-9 items-center gap-2 rounded-full bg-card pr-3.5 pl-3 text-sm text-foreground shadow-raised transition-[box-shadow,scale] duration-150 ease-out outline-none hover:shadow-raised-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]"
                    >
                      <IconTemplate aria-hidden className="size-4 text-muted-foreground" />
                      {template.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="px-4 has-data-[icon=inline-end]:pr-3.5" render={<Link href={startHref} />}>
                Start a mission
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span className="flex items-center gap-2">
            <Mark className="size-4 text-muted-foreground" />
            Mission Control · The demo above is a recorded mission.
          </span>
          <span>
            Built by{" "}
            <a
              href="https://eagledev.in"
              target="_blank"
              rel="noopener"
              className="font-medium text-foreground underline decoration-border decoration-from-font underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-foreground"
            >
              eagledev.in
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
