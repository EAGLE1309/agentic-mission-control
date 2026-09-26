import { z } from "zod";
import { internal } from "../../_generated/api";
import { TOOLS } from "../../../src/shared/agents";
import { appSpec, type UsableApp } from "../../../src/shared/apps";
import type { ActionCtx } from "../../_generated/server";
import type { MissionMode, TaskRole, ToolName } from "../../../src/shared/events";
import type { LlmToolDefinition } from "../llm/types";
import { liveFetchUrl, liveWebSearch } from "./live";
import { runSimulatedAppTool, runSimulatedTool } from "./simulated";

// Tools (tech spec §7.5). Web tools only read. The app tools of the librarian
// search the user's apps, and create new items only where the user allows it.
// A tool error goes back to the model as data. It does not stop the worker.

const httpUrl = z.url({ protocol: /^https?$/ }).max(2_000);

export const toolInputSchemas = {
  web_search: z.object({ query: z.string().trim().min(2).max(200) }),
  fetch_url: z.object({ url: httpUrl, focus: z.string().trim().max(200).optional() }),
  write_section: z.object({
    title: z.string().trim().min(1).max(120),
    markdown: z.string().trim().min(1).max(20_000),
    sources: z
      .array(z.object({ url: httpUrl, title: z.string().trim().max(200) }))
      .max(20)
      .default([]),
  }),
  app_search: z.object({ app: z.string().trim().min(1).max(40), query: z.string().trim().min(2).max(200) }),
  app_write: z.object({
    app: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(20_000),
    target: z.string().trim().max(200).optional(),
  }),
} satisfies Record<ToolName, z.ZodType>;

export type WebSearchInput = z.infer<typeof toolInputSchemas.web_search>;
export type FetchUrlInput = z.infer<typeof toolInputSchemas.fetch_url>;
export type WriteSectionInput = z.infer<typeof toolInputSchemas.write_section>;
export type AppSearchInput = z.infer<typeof toolInputSchemas.app_search>;
export type AppWriteInput = z.infer<typeof toolInputSchemas.app_write>;

function specOf(name: ToolName): string {
  return TOOLS.find((tool) => tool.name === name)?.description ?? name;
}

function definition(name: ToolName): LlmToolDefinition {
  return { name, description: specOf(name), input: toolInputSchemas[name] };
}

/** app_search with the apps that allow search as an enum, or null when there are none. */
function appSearchDefinition(apps: readonly UsableApp[]): LlmToolDefinition | null {
  const readable = apps.filter((app) => app.read);
  if (readable.length === 0) return null;
  const slugs = readable.map((app) => app.slug) as [string, ...string[]];
  return {
    name: "app_search",
    description: `${specOf("app_search")} Apps: ${readable.map((app) => `${app.slug} (${app.name})`).join(", ")}.`,
    input: z.object({ app: z.enum(slugs), query: z.string().trim().min(2).max(200) }),
  };
}

/** app_write with the apps that allow creating items, and what target means in each. */
function appWriteDefinition(apps: readonly UsableApp[]): LlmToolDefinition | null {
  const writable = apps.filter((app) => app.write);
  if (writable.length === 0) return null;
  const slugs = writable.map((app) => app.slug) as [string, ...string[]];
  const lines = writable.map((app) => {
    const write = appSpec(app.slug).write;
    return `${app.slug} creates ${write?.creates ?? "items"}${write?.target ? `; target is ${write.target}` : ""}`;
  });
  return {
    name: "app_write",
    description: `${specOf("app_write")} ${lines.join(". ")}.`,
    input: toolInputSchemas.app_write.extend({ app: z.enum(slugs) }),
  };
}

/** The tools a task can call now. With no tool calls left, only write_section stays. */
export function toolsForTask(
  role: TaskRole,
  toolCallsLeft: number,
  options: { apps?: readonly UsableApp[]; writesLeft?: number } = {},
): LlmToolDefinition[] {
  if (role === "researcher" && toolCallsLeft > 0) {
    return [definition("web_search"), definition("fetch_url"), definition("write_section")];
  }
  if (role === "librarian" && toolCallsLeft > 0) {
    const tools: LlmToolDefinition[] = [];
    const search = appSearchDefinition(options.apps ?? []);
    if (search) tools.push(search);
    const write = (options.writesLeft ?? 0) > 0 ? appWriteDefinition(options.apps ?? []) : null;
    if (write) tools.push(write);
    return [...tools, definition("write_section")];
  }
  return [definition("write_section")];
}

export type ToolOutcome = {
  ok: boolean;
  /** The text the model gets back. */
  output: string;
  /** The full result, saved as an artifact when it is longer than the preview. */
  fullText: string;
  error?: string;
};

export type ToolRunContext = {
  ctx: ActionCtx;
  seed: string;
  /** Used by fetch_url when the model gives no focus. */
  focusFallback: string;
};

export async function runTool(
  mode: MissionMode,
  name: "web_search" | "fetch_url",
  input: WebSearchInput | FetchUrlInput,
  context: ToolRunContext,
): Promise<ToolOutcome> {
  if (mode === "simulated") return runSimulatedTool(name, input, context);
  if (name === "web_search") return liveWebSearch(context.ctx, input as WebSearchInput);
  return liveFetchUrl(context.ctx, input as FetchUrlInput, context.focusFallback);
}

function failure(error: string): ToolOutcome {
  return { ok: false, output: `Error: ${error}`, fullText: "", error };
}

/** app_search or app_write for the librarian. The live check of the permission runs in appTools. */
export async function runAppTool(
  mode: MissionMode,
  name: "app_search" | "app_write",
  input: AppSearchInput | AppWriteInput,
  context: ToolRunContext & { userId: string; apps: readonly UsableApp[] },
): Promise<ToolOutcome> {
  const app = context.apps.find((item) => item.slug === input.app);
  const allowed = context.apps.filter((item) => (name === "app_search" ? item.read : item.write)).map((item) => item.slug);
  if (!app || !allowed.includes(app.slug)) {
    return failure(`"${input.app}" is not available for ${name}. Use one of: ${allowed.join(", ") || "none"}.`);
  }
  if (mode === "simulated") return runSimulatedAppTool(name, input, context, app);
  if (name === "app_search") {
    const { query } = input as AppSearchInput;
    return await context.ctx.runAction(internal.engine.appTools.run, { userId: context.userId, app: app.slug, action: "search", query });
  }
  const { title, content, target } = input as AppWriteInput;
  return await context.ctx.runAction(internal.engine.appTools.run, {
    userId: context.userId,
    app: app.slug,
    action: "write",
    title,
    content,
    ...(target ? { target } : {}),
  });
}
