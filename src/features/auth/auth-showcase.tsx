import { blurIn } from "@/features/landing/blur-in-text";
import { FollowUpIllustration } from "@/features/landing/illustrations";

/**
 * The right half of the auth pages on wide screens (design §6.12): the landing
 * headline on a plain grey panel, with the chat illustration. The auth layout
 * keeps it mounted between sign-in and sign-up, so it blurs in only once.
 */
export function AuthShowcase() {
  return (
    <aside aria-label="About Mission Control" className="sticky top-0 hidden h-dvh p-2 lg:flex">
      <div
        className="blur-in flex flex-1 flex-col justify-between gap-12 overflow-hidden rounded-3xl bg-card p-10 xl:p-14"
        style={blurIn(150, { y: 12, blur: 8, duration: 900 })}
      >
        <div className="flex max-w-xl flex-col gap-4">
          <p className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance xl:text-5xl">
            Give it a goal.
            <br />
            <span className="text-muted-foreground">Watch the agents work.</span>
          </p>
          <p className="text-base leading-relaxed text-pretty text-muted-foreground">
            An orchestrator splits your goal into tasks. Agents research in parallel, and you see every step. Then you
            get a report with sources.
          </p>
        </div>
        <FollowUpIllustration className="w-full max-w-md" />
      </div>
    </aside>
  );
}
