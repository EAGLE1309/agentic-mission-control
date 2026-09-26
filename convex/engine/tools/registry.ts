import { z } from "zod";
import { TOOLS } from "../../../src/shared/agents";
import type { ActionCtx } from "../../_generated/server";
import type { MissionMode, TaskRole, ToolName } from "../../../src/shared/events";
import type { LlmToolDefinition } from "../llm/types";
import { liveFetchUrl, liveWebSearch } from "./live";
import { runSimulatedTool } from "./simulated";

// Tools (tech spec §7.5). All tools are read-only. A tool error goes back to
// the model as data. It does not stop the worker.

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
} satisfies Record<ToolName, z.ZodType>;

export type WebSearchInput = z.infer<typeof toolInputSchemas.web_search>;
export type FetchUrlInput = z.infer<typeof toolInputSchemas.fetch_url>;
export type WriteSectionInput = z.infer<typeof toolInputSchemas.write_section>;

function definition(name: ToolName): LlmToolDefinition {
  const spec = TOOLS.find((tool) => tool.name === name);
  return { name, description: spec?.description ?? name, input: toolInputSchemas[name] };
}

/** The tools a task can call now. With no tool calls left, only write_section stays. */
export function toolsForTask(role: TaskRole, toolCallsLeft: number): LlmToolDefinition[] {
  if (role === "researcher" && toolCallsLeft > 0) {
    return [definition("web_search"), definition("fetch_url"), definition("write_section")];
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
