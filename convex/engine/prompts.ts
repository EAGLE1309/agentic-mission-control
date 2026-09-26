import { appSpec, isAppSlug, type UsableApp } from "../../src/shared/apps";
import type { NodeStatus, Source } from "../../src/shared/events";

/** The apps of the user in plain lines. The librarian also gets the notes of each app. */
function appLines(apps: readonly UsableApp[], withNotes = false): string[] {
  return apps.map((app) => {
    const spec = appSpec(app.slug);
    const can = [app.read ? "search" : null, app.write && spec.write ? `create ${spec.write.creates}` : null].filter(Boolean);
    const target = app.write && spec.write?.target ? ` (target: ${spec.write.target})` : "";
    const notes = withNotes && spec.notes ? `\n  How ${app.name} works: ${spec.notes}` : "";
    return `- ${app.slug} (${app.name}): ${can.join(", ")}${target}${notes}`;
  });
}

// Prompt text built from mission data. The system prompts are in
// src/shared/agents.ts, so the Agents page shows the same text.

/** The connected apps, and the apps that can take the report (saveTo). */
function appSection(apps: readonly UsableApp[]): string[] {
  const writable = apps.filter((app) => app.write && appSpec(app.slug).write);
  return [
    apps.length > 0 ? "Connected apps of the user (the librarian can use them):" : "The user has no connected apps. Do not use the librarian role.",
    ...appLines(apps),
    "",
    writable.length > 0
      ? `Apps that can take the finished report (saveTo.app): ${writable.map((app) => app.slug).join(", ")}.`
      : "No app can take the finished report, so saveTo is null.",
  ];
}

function oneLine(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

// Prompt text built from mission data. The system prompts are in
// src/shared/agents.ts, so the Agents page shows the same text.

export function planPrompt(goal: string, feedback: string[], apps: readonly UsableApp[] = []): string {
  const lines = ["Goal:", goal.trim(), "", ...appSection(apps)];
  if (feedback.length > 0) {
    lines.push("", "Your last plan was not valid:", ...feedback.map((line) => `- ${line}`), "", "Make a new plan that fixes these problems.");
  }
  return lines.join("\n");
}

const STATUS_WORD: Record<NodeStatus, string> = {
  pending: "not started",
  queued: "waiting",
  running: "running",
  done: "done",
  failed: "failed",
  killed: "stopped",
};

export type DirectState = {
  goal: string;
  message: string;
  tasks: {
    id: string;
    role: string;
    title: string;
    instructions: string;
    status: NodeStatus;
    dependsOn: string[];
    error: string | null;
    summary: string | null;
  }[];
  turns: { message: string; status: NodeStatus; summary: string | null }[];
  report: { version: number; words: number; markdown: string } | null;
  saves: { app: string; url: string; title: string; version: number }[];
  apps: readonly UsableApp[];
};

/** The mission state and the message of the user, for the director of a follow-up (FR-25). */
export function directPrompt(state: DirectState, feedback: string[]): string {
  const lines = ["Mission goal:", state.goal.trim(), "", "Tasks, in plan order:"];
  if (state.tasks.length === 0) lines.push("- None: the plan was not made.");
  for (const task of state.tasks) {
    const deps = task.dependsOn.length > 0 ? `, depends on ${task.dependsOn.join(", ")}` : "";
    lines.push(`- ${task.id} (${task.role}, ${STATUS_WORD[task.status]}${deps}): ${task.title}`);
    lines.push(`  Instructions: ${oneLine(task.instructions, 400)}`);
    if (task.status === "done" && task.summary) lines.push(`  Output: ${oneLine(task.summary, 240)}`);
    if (task.status !== "done" && task.error) lines.push(`  Error: ${oneLine(task.error, 240)}`);
  }
  lines.push("");
  if (state.report) {
    lines.push(`Report: version ${state.report.version}, ${state.report.words} words.`, "<report>", state.report.markdown.trim(), "</report>");
  } else {
    lines.push("Report: none yet.");
  }
  lines.push("");
  if (state.saves.length > 0) {
    lines.push(
      "Saved copies of the report:",
      ...state.saves.map((copy) => `- ${isAppSlug(copy.app) ? appSpec(copy.app).name : copy.app}: [${copy.title}](${copy.url}), version ${copy.version}`),
    );
  } else {
    lines.push("Saved copies of the report: none.");
  }
  lines.push("", ...appSection(state.apps));
  if (state.turns.length > 0) {
    lines.push(
      "",
      "Earlier turns of this chat:",
      ...state.turns.map((turn) => `- The user wrote "${oneLine(turn.message, 240)}". Result: ${turn.summary ?? STATUS_WORD[turn.status]}.`),
    );
  }
  lines.push("", "The user writes:", "<message>", state.message.trim(), "</message>");
  if (feedback.length > 0) {
    lines.push("", "Your last answer was not valid:", ...feedback.map((line) => `- ${line}`), "", "Answer again and fix these problems.");
  }
  return lines.join("\n");
}

type Dependency = { title: string; status: string; markdown: string; sources: Source[]; error: string | null };

function sourceLines(sources: Source[]): string[] {
  return sources.map((item) => `- [${item.title || item.url}](${item.url})`);
}

export function taskPrompt(args: {
  goal: string;
  title: string;
  instructions: string;
  dependencies: Dependency[];
  apps?: readonly UsableApp[];
}): string {
  const lines = ["Mission goal:", args.goal.trim(), "", `Your task: ${args.title}`, args.instructions.trim()];
  if (args.apps && args.apps.length > 0) lines.push("", "Apps you can use:", ...appLines(args.apps, true));
  const done = args.dependencies.filter((dep) => dep.status === "done");
  const missing = args.dependencies.filter((dep) => dep.status !== "done");
  if (done.length > 0) {
    lines.push("", "Outputs of earlier tasks:");
    for (const dep of done) {
      lines.push("", `<task_output title="${dep.title}">`, dep.markdown.trim(), "</task_output>");
      if (dep.sources.length > 0) lines.push("Sources of this output:", ...sourceLines(dep.sources));
    }
  }
  if (missing.length > 0) {
    lines.push(
      "",
      "Missing inputs. These earlier tasks failed. Do not guess their content. Say in your section what is missing:",
      ...missing.map((dep) => `- ${dep.title}${dep.error ? ` (${dep.error})` : ""}`),
    );
  }
  return lines.join("\n");
}

export function assemblePrompt(args: {
  goal: string;
  title: string | null;
  inputs: { title: string; markdown: string }[];
  failed: string[];
  /** A follow-up that rewrites the report can ask for changes too. */
  instruction?: string | null;
}): string {
  const lines = ["Mission goal:", args.goal.trim()];
  if (args.title) lines.push("", `Report title: ${args.title}`);
  if (args.instruction?.trim()) lines.push("", "The user asked for this version:", args.instruction.trim());
  lines.push("", "Task sections:");
  for (const input of args.inputs) {
    lines.push("", `<section title="${input.title}">`, input.markdown.trim(), "</section>");
  }
  if (args.failed.length > 0) {
    lines.push("", "These tasks failed. The report must not cover them:", ...args.failed.map((title) => `- ${title}`));
  }
  return lines.join("\n");
}

export function revisionPrompt(args: { goal: string; report: string; instruction: string }): string {
  return [
    "Mission goal:",
    args.goal.trim(),
    "",
    "Current report:",
    "<report>",
    args.report.trim(),
    "</report>",
    "",
    "Change instruction from the user:",
    args.instruction.trim(),
  ].join("\n");
}

/** The first sentence of the first paragraph, for the node card and the trace. */
export function summarize(markdown: string, max = 160): string {
  const paragraph =
    markdown
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find((block) => block && !block.startsWith("#") && !block.startsWith("|")) ?? markdown.trim();
  const plain = paragraph
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

export function dedupeSources(sources: Source[]): Source[] {
  const seen = new Map<string, Source>();
  for (const item of sources) {
    const key = item.url.replace(/#.*$/, "").replace(/\/$/, "");
    if (!seen.has(key)) seen.set(key, { url: item.url, title: item.title.trim() || item.url });
  }
  return [...seen.values()];
}

/**
 * The final report: the model body, then the missing-part note (FR-19), then
 * the Sources list (FR-15). The engine adds both, so a model cannot drop them.
 */
export function finishReport(args: { body: string; title: string; failed: string[]; sources: Source[] }): string {
  let body = args.body.trim();
  const sourcesAt = body.search(/\n#{1,3}\s+Sources\s*\n/i);
  if (sourcesAt !== -1) body = body.slice(0, sourcesAt).trimEnd();
  if (!body.startsWith("# ")) body = `# ${args.title}\n\n${body}`;
  const parts = [body];
  if (args.failed.length > 0) {
    parts.push(
      [
        "## Missing parts",
        "",
        "These tasks failed, so this report does not cover them:",
        "",
        ...args.failed.map((title) => `- ${title}`),
      ].join("\n"),
    );
  }
  if (args.sources.length > 0) {
    parts.push(["## Sources", "", ...args.sources.map((item, index) => `${index + 1}. [${item.title}](${item.url})`)].join("\n"));
  }
  return `${parts.join("\n\n")}\n`;
}
