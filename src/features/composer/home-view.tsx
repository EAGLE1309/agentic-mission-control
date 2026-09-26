"use client";

import { api } from "@convex/_generated/api";
import { IconTemplate } from "@tabler/icons-react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mark } from "@/components/mark";
import { GOAL_MAX_CHARS } from "@/shared/constants";
import { appErrorData, type AppErrorData } from "@/shared/errors";
import type { ModelProfile } from "@/shared/events";
import { TEMPLATES, findTemplate } from "@/shared/templates";
import { Composer, type ComposerHandle } from "./composer";
import { useMissionAvailability } from "./use-mission-availability";

const PROFILE_KEY = "mc:model-profile";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readProfile(): ModelProfile {
  try {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    return stored === "fast" || stored === "balanced" ? stored : "balanced";
  } catch {
    return "balanced";
  }
}

/** Home: new mission (FR-8 to FR-11, design §6.2). */
export function HomeView({ templateId }: { templateId: string | null }) {
  const router = useRouter();
  const createMission = useMutation(api.missions.create);
  const composerRef = useRef<ComposerHandle>(null);
  const [goal, setGoal] = useState(() => findTemplate(templateId)?.goal ?? "");
  const storedProfile = useSyncExternalStore(subscribeStorage, readProfile, () => "balanced" as const);
  const [chosenProfile, setChosenProfile] = useState<ModelProfile | null>(null);
  const profile = chosenProfile ?? storedProfile;
  const [pending, setPending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<AppErrorData | null>(null);
  const availability = useMissionAvailability(limitError);

  // Focus the composer on devices with a fine pointer, or after a template.
  useEffect(() => {
    if (templateId || window.matchMedia("(pointer: fine)").matches) composerRef.current?.focus();
  }, [templateId]);

  const changeProfile = (next: ModelProfile) => {
    setChosenProfile(next);
    try {
      window.localStorage.setItem(PROFILE_KEY, next);
    } catch {
      // Storage can be blocked. The choice then lasts for this page only.
    }
  };

  const applyTemplate = (id: string) => {
    const template = findTemplate(id);
    if (!template) return;
    setGoal(template.goal);
    setInputError(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const submit = async (value: string) => {
    setPending(true);
    setInputError(null);
    try {
      const missionId = await createMission({ goal: value, modelProfile: profile });
      // Keep the composer busy until the run view opens (FR-11).
      router.push(`/missions/${missionId}`);
    } catch (error) {
      setPending(false);
      const data = appErrorData(error);
      if (data?.code === "QUOTA_EXCEEDED" || data?.code === "CAPACITY_EXHAUSTED") setLimitError(data);
      else if (data?.code === "INVALID_INPUT") setInputError(data.message ?? "Enter a goal.");
      else setInputError("The mission did not start. Check your connection, then try again.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-[18dvh] pb-10 md:px-6">
      <div className="flex size-10 items-center justify-center rounded-lg bg-card shadow-raised">
        <Mark className="text-foreground" />
      </div>
      <h1 id="home-title" className="mt-3 text-xl font-semibold tracking-[-0.01em] text-balance">
        What&rsquo;s the mission?
      </h1>

      <Composer
        ref={composerRef}
        className="mt-6"
        value={goal}
        onChange={(value) => {
          setGoal(value);
          if (inputError) setInputError(null);
        }}
        onSubmit={submit}
        placeholder="Describe the goal…"
        labelledBy="home-title"
        submitLabel="Start mission"
        pending={pending}
        blocked={availability.blocked}
        banner={availability.banner}
        bannerTone={availability.tone}
        error={inputError}
        profile={profile}
        onProfileChange={changeProfile}
        maxLength={GOAL_MAX_CHARS}
      />

      <section className="mt-8 flex flex-col gap-1" aria-labelledby="templates-label">
        <h2 id="templates-label" className="px-2 text-xs text-muted-foreground">
          Start from a template
        </h2>
        <ul className="flex flex-col">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => applyTemplate(template.id)}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-[background-color] duration-150 hover:bg-accent"
              >
                <IconTemplate aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{template.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
