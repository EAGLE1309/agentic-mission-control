"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

// "How it works" (design §6.12): three steps, each with a real UI crop. On a
// wide screen, the steps are a list of buttons and the crop changes with a
// short blurred crossfade. On a narrow screen, each step shows its own crop.

const STEPS = [
  {
    title: "Write a goal.",
    text: "Say what you want to know, in a few lines. Start from a template, or write your own.",
    image: "step-1",
    alt: "The composer with a goal about vector databases",
  },
  {
    title: "Watch the plan run.",
    text: "The orchestrator splits the goal into 2 to 6 tasks. Agents search and read in parallel, and each tool call shows on the graph.",
    image: "step-2",
    alt: "The mission graph with research tasks, their tools, and live edges",
  },
  {
    title: "Read the report.",
    text: "The assembler merges the work into one report with sources. Download it, ask for changes, or save it to an app.",
    image: "step-3",
    alt: "The report with its sections and version menu",
  },
] as const;

type Step = (typeof STEPS)[number];

function StepImage({ step, sizes, className }: { step: Step; sizes: string; className?: string }) {
  return (
    <>
      <Image
        src={`/landing/${step.image}-light.png`}
        alt={step.alt}
        width={800}
        height={500}
        sizes={sizes}
        className={cn("block h-auto w-full dark:hidden", className)}
      />
      <Image
        src={`/landing/${step.image}-dark.png`}
        alt={step.alt}
        width={800}
        height={500}
        sizes={sizes}
        className={cn("hidden h-auto w-full dark:block", className)}
      />
    </>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <>
      {/* Narrow screens: a plain numbered list. */}
      <ol className="flex flex-col gap-10 md:hidden">
        {STEPS.map((step, index) => (
          <li key={step.image} className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl bg-card shadow-raised">
              <StepImage step={step} sizes="100vw" />
            </div>
            <StepText step={step} index={index} />
          </li>
        ))}
      </ol>

      {/* Wide screens: the steps pick the crop. */}
      <div className="hidden gap-10 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-16">
        <ol className="flex flex-col gap-1 self-center">
          {STEPS.map((step, index) => {
            const current = index === active;
            return (
              <li key={step.image}>
                <button
                  type="button"
                  aria-pressed={current}
                  aria-controls="how-it-works-figure"
                  onClick={() => setActive(index)}
                  className={cn(
                    "group flex w-full rounded-xl p-4 text-left outline-none",
                    "transition-[background-color,box-shadow] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
                    current ? "bg-card shadow-raised" : "hover:bg-muted/70",
                  )}
                >
                  <StepText step={step} index={index} current={current} />
                </button>
              </li>
            );
          })}
        </ol>

        <figure id="how-it-works-figure" aria-live="polite" className="relative m-0">
          <div className="rounded-[20px] bg-muted/60 p-1.5 shadow-raised">
            {/* The grid stacks the crops in one cell, so the frame keeps their size. */}
            <div className="grid overflow-hidden rounded-[14px] bg-card">
              {STEPS.map((step, index) => {
                const current = index === active;
                return (
                  <div
                    key={step.image}
                    aria-hidden={!current}
                    className={cn(
                      "col-start-1 row-start-1 transition-[opacity,filter,scale] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      "motion-reduce:transition-[opacity] motion-reduce:duration-200",
                      current
                        ? "scale-100 opacity-100 blur-[0px]"
                        : "pointer-events-none scale-[1.015] opacity-0 blur-[6px] motion-reduce:scale-100 motion-reduce:blur-[0px]",
                    )}
                  >
                    <StepImage step={step} sizes="(min-width: 1152px) 680px, 60vw" />
                  </div>
                );
              })}
            </div>
          </div>
        </figure>
      </div>
    </>
  );
}

/** `current` is set only in the switcher: the picked step gets the blue number. */
function StepText({ step, index, current }: { step: Step; index: number; current?: boolean }) {
  return (
    <span className="flex gap-3.5">
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-[background-color,color] duration-150",
          current === true
            ? "bg-live-subtle text-live"
            : current === false
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-foreground",
        )}
      >
        {index + 1}
      </span>
      <span className="flex flex-col gap-1">
        <span
          className={cn(
            "text-base font-semibold transition-colors duration-150",
            current === false ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {step.title}
        </span>
        <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{step.text}</span>
      </span>
    </span>
  );
}
