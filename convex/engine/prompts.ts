import type { Source } from "../../src/shared/events";

// Prompt text built from mission data. The system prompts are in
// src/shared/agents.ts, so the Agents page shows the same text.

export function planPrompt(goal: string, feedback: string[]): string {
  const lines = ["Goal:", goal.trim()];
  if (feedback.length > 0) {
    lines.push("", "Your last plan was not valid:", ...feedback.map((line) => `- ${line}`), "", "Make a new plan that fixes these problems.");
  }
  return lines.join("\n");
}

type Dependency = { title: string; status: string; markdown: string; sources: Source[]; error: string | null };

function sourceLines(sources: Source[]): string[] {
  return sources.map((item) => `- [${item.title || item.url}](${item.url})`);
}

export function taskPrompt(args: { goal: string; title: string; instructions: string; dependencies: Dependency[] }): string {
  const lines = ["Mission goal:", args.goal.trim(), "", `Your task: ${args.title}`, args.instructions.trim()];
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
}): string {
  const lines = ["Mission goal:", args.goal.trim()];
  if (args.title) lines.push("", `Report title: ${args.title}`);
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
