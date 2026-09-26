import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, generateText, streamText, tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import type { AgentRole } from "../../../src/shared/agents";
import {
  MODEL_ATTEMPTS_PER_CALL,
  MODEL_CALL_TIMEOUT_MS,
  PROVIDER_429_MAX_ATTEMPTS,
} from "../../../src/shared/constants";
import type { ModelProfile } from "../../../src/shared/events";
import { CATALOG_STALE_MS, MODEL_PRESETS, ROLES_WITH_TOOLS, type ModelOverrides } from "../../../src/shared/models";
import { BudgetSignal, StopSignal } from "../gate";
import { estimateTokens, sleep } from "../random";
import { jsonCandidates } from "./json";
import {
  LlmError,
  type LlmClient,
  type LlmMessage,
  type LlmToolDefinition,
  type ObjectArgs,
  type ObjectResult,
  type StepArgs,
  type StepResult,
  type ToolCallRequest,
} from "./types";

// The OpenRouter client (tech spec §7.2). It tries each model of the chain.
// A 429 waits for Retry-After and tries the same model again. Other errors,
// and output that does not match the schema after one repair, go to the
// next model. Every request calls acquire() first.

export type CatalogEntry = {
  modelId: string;
  supportsTools: boolean;
  supportsStructured: boolean;
  lastSeenAt: number;
};

const MAX_RETRY_AFTER_MS = 30_000;

class AttemptsUsed extends Error {}

function toModelMessages(messages: LlmMessage[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (message.role === "user") return { role: "user", content: message.content };
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: [
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
          ...message.toolCalls.map((call) => ({
            type: "tool-call" as const,
            toolCallId: call.id,
            toolName: call.name,
            input: call.input ?? {},
          })),
        ],
      };
    }
    return {
      role: "tool",
      content: message.results.map((result) => ({
        type: "tool-result" as const,
        toolCallId: result.id,
        toolName: result.name,
        output: result.isError ? { type: "error-text" as const, value: result.output } : { type: "text" as const, value: result.output },
      })),
    };
  });
}

function toToolSet(definitions: LlmToolDefinition[]): ToolSet {
  return Object.fromEntries(
    definitions.map((definition) => [definition.name, tool({ description: definition.description, inputSchema: definition.input })]),
  );
}

function retryAfterMs(error: APICallError, attempt: number): number {
  const header = error.responseHeaders?.["retry-after"];
  const seconds = Number(header);
  if (header && Number.isFinite(seconds)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, seconds * 1000));
  const date = header ? Date.parse(header) : Number.NaN;
  if (Number.isFinite(date)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - Date.now()));
  return Math.min(MAX_RETRY_AFTER_MS, 1_000 * 2 ** attempt);
}

function describe(error: unknown): string {
  if (APICallError.isInstance(error)) return `HTTP ${error.statusCode ?? "error"}: ${error.message}`.slice(0, 300);
  if (error instanceof z.ZodError) return `The output did not match the schema: ${error.issues.map((issue) => issue.message).join("; ")}`.slice(0, 300);
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Unknown error.";
}

function isControl(error: unknown): boolean {
  return error instanceof StopSignal || error instanceof BudgetSignal;
}

export function createOpenRouterClient(options: {
  apiKey: string;
  profile: ModelProfile;
  catalog: CatalogEntry[];
  now: number;
  siteUrl?: string;
  /** Chains set by env (OPENROUTER_MODELS...). They are used as given. */
  overrides?: ModelOverrides;
}): LlmClient {
  const provider = createOpenRouter({
    apiKey: options.apiKey,
    headers: { "HTTP-Referer": options.siteUrl ?? "https://mission-control.local", "X-Title": "Mission Control" },
  });
  const byId = new Map(options.catalog.map((entry) => [entry.modelId, entry]));

  /** The chain without models gone from the catalog for 48 hours. An empty catalog skips nothing. */
  const chainFor = (role: AgentRole): string[] => {
    // A chain from env is the choice of the owner: no catalog skipping.
    const override = options.overrides?.[role];
    if (override && override.length > 0) return [...override];
    const base = [...MODEL_PRESETS[options.profile][role]];
    if (options.catalog.length === 0) return base;
    const fresh = base.filter((id) => {
      const entry = byId.get(id);
      return entry !== undefined && options.now - entry.lastSeenAt <= CATALOG_STALE_MS;
    });
    const usable = ROLES_WITH_TOOLS.includes(role) ? fresh.filter((id) => byId.get(id)?.supportsTools) : fresh;
    return usable.length > 0 ? usable : fresh.length > 0 ? fresh : base;
  };

  /**
   * Run `request` on each model of the chain, with 429 retries, until one
   * succeeds. At most MODEL_ATTEMPTS_PER_CALL provider requests in total.
   */
  async function withFallback<T>(
    role: AgentRole,
    acquire: () => Promise<void>,
    request: (modelId: string, repair: string | null) => Promise<T>,
    isRepairable: (error: unknown) => boolean = () => false,
  ): Promise<T> {
    let attempts = 0;
    let lastError: unknown = null;
    let lastWasRateLimit = false;
    try {
      for (const modelId of chainFor(role)) {
        let repair: string | null = null;
        for (let tryOnModel = 1; ; tryOnModel += 1) {
          if (attempts >= MODEL_ATTEMPTS_PER_CALL) throw new AttemptsUsed();
          attempts += 1;
          await acquire();
          try {
            return await request(modelId, repair);
          } catch (error) {
            if (isControl(error)) throw error;
            lastError = error;
            lastWasRateLimit = APICallError.isInstance(error) && error.statusCode === 429;
            if (lastWasRateLimit && tryOnModel < PROVIDER_429_MAX_ATTEMPTS) {
              await sleep(retryAfterMs(error as APICallError, tryOnModel));
              continue;
            }
            // One repair on the same model for output that does not match the schema.
            if (repair === null && isRepairable(error)) {
              repair = describe(error);
              continue;
            }
            break;
          }
        }
      }
    } catch (error) {
      if (!(error instanceof AttemptsUsed)) throw error;
    }
    throw new LlmError(`No model answered. Last error: ${describe(lastError)}`, lastWasRateLimit);
  }

  return {
    mode: "live",

    modelFor(role) {
      return chainFor(role)[0] ?? MODEL_PRESETS[options.profile][role][0];
    },

    async step(args: StepArgs): Promise<StepResult> {
      return withFallback(args.role, args.acquire, async (modelId) => {
        const started = Date.now();
        const result = streamText({
          model: provider.chat(modelId),
          system: args.system,
          messages: toModelMessages(args.messages),
          ...(args.tools.length > 0 ? { tools: toToolSet(args.tools), toolChoice: "auto" as const } : {}),
          maxRetries: 0,
          timeout: MODEL_CALL_TIMEOUT_MS,
        });
        let text = "";
        const toolCalls: ToolCallRequest[] = [];
        let usage: { inputTokens?: number; outputTokens?: number } | undefined;
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            text += part.text;
            args.onDelta?.(part.text);
          } else if (part.type === "tool-call") {
            // An invalid call goes to the worker too: it returns the error to the model as data.
            toolCalls.push({ id: part.toolCallId, name: part.toolName, input: part.input });
          } else if (part.type === "finish") {
            usage = part.totalUsage;
          } else if (part.type === "error") {
            throw part.error;
          }
        }
        return {
          text,
          toolCalls,
          usage: {
            inputTokens: usage?.inputTokens ?? estimateTokens(args.system + JSON.stringify(args.messages)),
            outputTokens: usage?.outputTokens ?? estimateTokens(text + JSON.stringify(toolCalls)),
          },
          model: modelId,
          latencyMs: Date.now() - started,
        };
      });
    },

    async object<T>(args: ObjectArgs<T>): Promise<ObjectResult<T>> {
      const schemaText = JSON.stringify(z.toJSONSchema(args.schema));
      const system = `${args.system}\n\nAnswer with only one JSON object that matches this JSON Schema. No markdown and no comments.\n${schemaText}`;
      return withFallback(
        args.role,
        args.acquire,
        async (modelId, repair) => {
          const started = Date.now();
          const prompt = repair
            ? `${args.prompt}\n\nYour last answer was not valid: ${repair}\nAnswer again with only the JSON object.`
            : args.prompt;
          const result = await generateText({
            model: provider.chat(modelId),
            system,
            prompt,
            maxRetries: 0,
            timeout: MODEL_CALL_TIMEOUT_MS,
          });
          const candidates = jsonCandidates(result.text);
          let lastIssue: z.ZodError | null = null;
          for (const candidate of candidates) {
            const parsed = args.schema.safeParse(candidate);
            if (parsed.success) {
              return {
                object: parsed.data,
                usage: {
                  inputTokens: result.usage.inputTokens ?? estimateTokens(system + prompt),
                  outputTokens: result.usage.outputTokens ?? estimateTokens(result.text),
                },
                model: modelId,
                latencyMs: Date.now() - started,
              };
            }
            lastIssue ??= parsed.error;
          }
          throw lastIssue ?? new z.ZodError([{ code: "custom", message: "The answer has no JSON object.", path: [], input: result.text }]);
        },
        (error) => error instanceof z.ZodError,
      );
    },
  };
}
