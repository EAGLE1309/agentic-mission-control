import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { LandingDemo } from "@/features/landing/landing-demo";

// Landing (FR-1, design §6.12). The recorded demo is the only motion on the page.

const STEPS = [
  {
    title: "Write a goal.",
    text: "Describe what you want to know. Start from a template, or type your own.",
    image: "step-1",
    alt: "The composer with a goal about vector databases",
  },
  {
    title: "Watch the plan run.",
    text: "The orchestrator splits the goal into tasks. Agents search and read in parallel, and you see each tool call.",
    image: "step-2",
    alt: "The mission graph with research tasks, their tools, and live edges",
  },
  {
    title: "Read the report.",
    text: "The assembler merges the work into a report with sources. Download it, or ask for changes.",
    image: "step-3",
    alt: "The report with its sections and version menu",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 md:px-6">
        <Mark className="text-foreground" />
        <span className="flex-1 text-sm font-semibold">Mission Control</span>
        <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
          Sign in
        </Button>
        <Button size="sm" render={<Link href="/sign-up" />}>
          Get started
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 md:px-6">
        <section className="flex flex-col items-start gap-6 pt-16 pb-12 md:pt-24">
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-5xl">
            Give it a goal.
            <br />
            Watch the agents work.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
            An orchestrator splits your goal into tasks. Agents research in parallel. You see each step, then get a report
            with sources.
          </p>
          <Button size="lg" render={<Link href="/sign-up" />}>
            Start a mission
          </Button>
        </section>

        <LandingDemo />

        <section className="flex flex-col gap-8 py-20" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-xl font-semibold tracking-[-0.01em]">
            How it works
          </h2>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.image} className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-xl bg-card shadow-raised">
                  <Image
                    src={`/landing/${step.image}-light.png`}
                    alt={step.alt}
                    width={800}
                    height={500}
                    className="block h-auto w-full dark:hidden"
                  />
                  <Image
                    src={`/landing/${step.image}-dark.png`}
                    alt={step.alt}
                    width={800}
                    height={500}
                    className="hidden h-auto w-full dark:block"
                  />
                </div>
                <div className="flex gap-3">
                  <span className="text-base font-semibold text-muted-foreground tabular-nums">{index + 1}.</span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm text-pretty text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t px-4 py-6 text-xs text-muted-foreground md:px-6">
        <span>Mission Control</span>
        <span>Free models through OpenRouter. The demo above is a recorded mission.</span>
      </footer>
    </div>
  );
}
