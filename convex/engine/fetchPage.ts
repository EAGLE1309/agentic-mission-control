"use node";

import { lookup } from "node:dns";
import { promises as dns } from "node:dns";
import { v } from "convex/values";
import { Agent, fetch as undiciFetch } from "undici";
import { internalAction } from "../_generated/server";
import { FETCH_MAX_BYTES, FETCH_MAX_REDIRECTS, FETCH_TIMEOUT_MS, JINA_TIMEOUT_MS } from "../../src/shared/constants";
import { htmlToText } from "./tools/html";
import { checkUrlShape, isBlockedAddress } from "./tools/ssrf";

// fetch_url reads one page (tech spec §7.5): Jina Reader first, then a direct
// fetch behind the SSRF guard. Node runs this action for the DNS checks.

type PageResult = { ok: true; title: string; text: string; via: "jina" | "direct" } | { ok: false; error: string };

const USER_AGENT = "MissionControlBot/1.0 (research agent; read-only)";

/**
 * A connect-time DNS lookup that refuses blocked addresses. The check runs on
 * the address the socket really uses, so DNS rebinding cannot pass it.
 */
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, "", 0);
        const list = Array.isArray(addresses) ? addresses : [{ address: addresses as unknown as string, family: 4 }];
        const safe = list.find((entry) => !isBlockedAddress(entry.address));
        if (!safe || list.some((entry) => isBlockedAddress(entry.address))) {
          return callback(new Error("This address is not allowed."), "", 0);
        }
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
        return callback(null, safe.address, safe.family);
      });
    },
  },
});

async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("The page is larger than 5 MB.");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

async function viaJina(url: string, signal: AbortSignal): Promise<PageResult> {
  const headers: Record<string, string> = { Accept: "text/plain", "X-Return-Format": "markdown" };
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
  const response = await fetch(`https://r.jina.ai/${url}`, { headers, signal });
  if (!response.ok) throw new Error(`Jina Reader returned HTTP ${response.status}.`);
  const raw = await readLimited(response.body, FETCH_MAX_BYTES);
  const title = /^Title:\s*(.*)$/m.exec(raw)?.[1]?.trim() ?? "";
  const marker = raw.indexOf("Markdown Content:");
  const text = (marker === -1 ? raw : raw.slice(marker + "Markdown Content:".length)).trim();
  if (text.length < 80) throw new Error("Jina Reader returned an empty page.");
  return { ok: true, title, text, via: "jina" };
}

async function viaDirect(start: string, signal: AbortSignal): Promise<PageResult> {
  let current = new URL(start);
  for (let hop = 0; hop <= FETCH_MAX_REDIRECTS; hop += 1) {
    const shape = checkUrlShape(current);
    if (shape) return { ok: false, error: shape };
    // A check before the request gives a clear error. The agent checks again at connect.
    const addresses = await dns.lookup(current.hostname.replace(/^\[|\]$/g, ""), { all: true });
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return { ok: false, error: "This address is not allowed." };
    }
    const response = await undiciFetch(current, {
      dispatcher: guardedAgent,
      redirect: "manual",
      signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return { ok: false, error: `The page redirected with no location (HTTP ${response.status}).` };
      // Check the next URL again (tech spec §7.5 step 2).
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, error: `The page returned HTTP ${response.status}.` };
    }
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml|text\/markdown/i.test(type)) {
      await response.body?.cancel();
      return { ok: false, error: `The page is not text (${type || "unknown type"}).` };
    }
    const body = await readLimited(response.body as ReadableStream<Uint8Array> | null, FETCH_MAX_BYTES);
    if (/text\/html|xhtml/i.test(type)) {
      const { title, text } = htmlToText(body);
      return { ok: true, title, text, via: "direct" };
    }
    return { ok: true, title: "", text: body.trim(), via: "direct" };
  }
  return { ok: false, error: "The page redirected too many times." };
}

export const run = internalAction({
  // forceDirect skips Jina. Only engine code and checks on a dev deployment use it.
  args: { url: v.string(), forceDirect: v.optional(v.boolean()) },
  handler: async (_ctx, args): Promise<PageResult> => {
    let url: URL;
    try {
      url = new URL(args.url);
    } catch {
      return { ok: false, error: "The URL is not valid." };
    }
    const shape = checkUrlShape(url);
    if (shape) return { ok: false, error: shape };

    if (!args.forceDirect) {
      try {
        return await viaJina(url.toString(), AbortSignal.timeout(JINA_TIMEOUT_MS));
      } catch {
        // Fall back to a direct fetch.
      }
    }
    try {
      return await viaDirect(url.toString(), AbortSignal.timeout(FETCH_TIMEOUT_MS));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The page did not load.";
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return { ok: false, error: "The page did not load in 15 seconds." };
      }
      return { ok: false, error: message.includes("not allowed") ? "This address is not allowed." : `The page did not load: ${message}` };
    }
  },
});
