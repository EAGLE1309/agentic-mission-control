import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { emit } from "./emit";
import { sleep } from "./random";

/** Thrown when the mission stops. The action ends without a failure event. */
export class StopSignal extends Error {
  constructor() {
    super("The mission stopped.");
    this.name = "StopSignal";
  }
}

/** Thrown by acquire() when the budget is empty. A worker then writes its section. */
export class BudgetSignal extends Error {
  constructor() {
    super("The mission used its model call budget.");
    this.name = "BudgetSignal";
  }
}

const GATE_ERRORS = {
  capacity: "Mission Control reached its shared model limit for today.",
  busy: "The model queue is full. The task waited too long for a model slot.",
} as const;

/**
 * Run before each model call (tech spec §7.4): check the stop flag and the
 * budget, and wait for a model slot. While it waits, the task shows "Queued".
 * Returns false when the budget is empty.
 */
export async function acquireCall(
  ctx: ActionCtx,
  args: {
    missionId: Id<"missions">;
    nodeId: string;
    attempt: number;
    model: string;
    ignoreBudget?: boolean;
    keep?: number;
  },
): Promise<boolean> {
  const gate = await ctx.runMutation(internal.engine.state.beginCall, {
    missionId: args.missionId,
    ignoreBudget: args.ignoreBudget,
    keep: args.keep,
  });
  if (!gate.ok) {
    if (gate.reason === "stopped") throw new StopSignal();
    if (gate.reason === "budget") return false;
    throw new Error(GATE_ERRORS[gate.reason]);
  }
  if (gate.waitMs > 0) {
    await emit(ctx, args.missionId, [
      { type: "node_queued", nodeId: args.nodeId, payload: { reason: "Waiting for a model slot", retryAfterMs: gate.waitMs } },
    ]);
    await sleep(gate.waitMs);
    // The same attempt resumes: the reducer treats this as a resume, not a retry.
    await emit(ctx, args.missionId, [
      { type: "node_started", nodeId: args.nodeId, payload: { attempt: args.attempt, model: args.model } },
    ]);
  }
  return true;
}

/** The acquire() callback for an LLM call. */
export function callGate(ctx: ActionCtx, args: Parameters<typeof acquireCall>[1]): () => Promise<void> {
  return async () => {
    if (!(await acquireCall(ctx, args))) throw new BudgetSignal();
  };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
