import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { NODE_LIVE_MIN_INTERVAL_MS } from "../../src/shared/constants";

const SENTENCE_END = /[.!?]\s+(?=\S)/g;

/** The text after the last finished sentence, or the end of the text. */
function currentThought(text: string): string {
  let start = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end < text.length) start = end;
  }
  return text.slice(start).replace(/\s+/g, " ").trim();
}

/**
 * Streams the thought of a task to nodeLive, 4 writes each second or less
 * (tech spec §7.4). Writes run in order. A failed write is skipped: the live
 * text is a preview, and the thought event has the full text.
 */
export class LiveText {
  private text = "";
  private lastWrite = 0;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly ctx: ActionCtx,
    private readonly missionId: Id<"missions">,
    private readonly nodeId: string,
  ) {}

  push = (delta: string) => {
    this.text += delta;
    const wait = NODE_LIVE_MIN_INTERVAL_MS - (Date.now() - this.lastWrite);
    if (wait <= 0) this.write();
    else if (!this.timer) this.timer = setTimeout(() => this.write(), wait);
  };

  /** Start a new step. */
  reset() {
    this.text = "";
  }

  /** Write the current text now and wait for all writes. */
  async flush() {
    this.write();
    await this.chain;
  }

  /** Clear the live text when the task ends. */
  async clear() {
    this.text = "";
    await this.flush();
  }

  private write() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.lastWrite = Date.now();
    const text = currentThought(this.text);
    this.chain = this.chain
      .then(async () => {
        await this.ctx.runMutation(internal.live.set, { missionId: this.missionId, nodeId: this.nodeId, text });
      })
      .catch(() => {});
  }
}
