import type { z } from "zod";
import type { AgentRole } from "../../../src/shared/agents";
import type { MissionMode, Source, TaskRole, ToolName } from "../../../src/shared/events";

// The model layer (tech spec §7.2). The engine talks only to LlmClient.
// Implementations: simulated (M3) and OpenRouter (M5).

export type ToolCallRequest = { id: string; name: string; input: unknown };

export type LlmMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCallRequest[] }
  | { role: "tool"; results: { id: string; name: string; output: string; isError: boolean }[] };

export type LlmUsage = { inputTokens: number; outputTokens: number };

export type LlmToolDefinition = {
  name: ToolName;
  description: string;
  input: z.ZodType;
};

/**
 * Structured facts about the call. The simulated client reads them to act
 * like a model. The OpenRouter client ignores them.
 */
export type SimContext = {
  seed: string;
  goal: string;
  task?: { id: string; role: TaskRole; title: string; instructions: string };
  inputs?: { title: string; markdown: string; sources: Source[] }[];
  failed?: string[];
  planTitle?: string;
  instruction?: string;
  previousReport?: string;
};

export type StepArgs = {
  role: AgentRole;
  /**
   * Called before each provider request, retries and fallbacks too. It checks
   * the stop flag, the budget, and the rate limits, and it can throw.
   */
  acquire: () => Promise<void>;
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  /** Called with each text delta while the model writes. */
  onDelta?: (delta: string) => void;
  sim: SimContext;
};

export type StepResult = {
  text: string;
  toolCalls: ToolCallRequest[];
  usage: LlmUsage;
  model: string;
  latencyMs: number;
};

export type ObjectArgs<T> = {
  role: AgentRole;
  /** Called before each provider request. See StepArgs.acquire. */
  acquire: () => Promise<void>;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  sim: SimContext;
};

export type ObjectResult<T> = {
  object: T;
  usage: LlmUsage;
  model: string;
  latencyMs: number;
};

export interface LlmClient {
  readonly mode: MissionMode;
  /** The first model of the chain for a role, for node_started. */
  modelFor(role: AgentRole): string;
  /** One model turn. It streams text deltas and can return tool calls. */
  step(args: StepArgs): Promise<StepResult>;
  /** One structured output that matches the schema. */
  object<T>(args: ObjectArgs<T>): Promise<ObjectResult<T>>;
}

/** A model error after all retries and fallbacks. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
