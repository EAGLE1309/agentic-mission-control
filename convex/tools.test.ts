import { describe, expect, test } from "vitest";
import { jsonCandidates } from "./engine/llm/json";
import { chunkText, rankChunks } from "./engine/tools/bm25";
import { htmlToText } from "./engine/tools/html";
import { checkUrlShape, isBlockedAddress } from "./engine/tools/ssrf";
import { BLOCKED_MODELS, MODEL_PRESETS, effectiveChains, modelOverrides } from "../src/shared/models";

describe("SSRF guard", () => {
  test("blocks private, loopback, link-local, metadata, and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::127.0.0.1",
      "64:ff9b::a9fe:a9fe",
      "not-an-ip",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  test("allows public addresses", () => {
    for (const address of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });

  test("checks the URL shape before DNS", () => {
    expect(checkUrlShape(new URL("https://example.com/a"))).toBeNull();
    expect(checkUrlShape(new URL("ftp://example.com/"))).toMatch(/http/);
    expect(checkUrlShape(new URL("http://user:pw@example.com/"))).toMatch(/credentials/);
    expect(checkUrlShape(new URL("http://localhost:3000/"))).toMatch(/not allowed/);
    expect(checkUrlShape(new URL("http://metadata.google.internal/"))).toMatch(/not allowed/);
    expect(checkUrlShape(new URL("http://[::1]/"))).toMatch(/not allowed/);
    expect(checkUrlShape(new URL("http://169.254.169.254/latest"))).toMatch(/not allowed/);
  });
});

describe("page text", () => {
  test("HTML to text drops scripts and keeps the words", () => {
    const { title, text } = htmlToText(
      "<html><head><title>Vector &amp; search</title><script>alert(1)</script></head><body><nav>Menu</nav><h1>Pinecone</h1><p>Costs &#36;70 each month.</p></body></html>",
    );
    expect(title).toBe("Vector & search");
    expect(text).toContain("Pinecone");
    expect(text).toContain("Costs $70 each month.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("Menu");
  });

  test("BM25 keeps the chunks about the focus, in page order, under the limit", () => {
    const filler = "General text about many unrelated things and more words here. ".repeat(30);
    const text = [filler, "Pricing: the managed plan costs 70 dollars and the free tier has limits.", filler, "Pricing tiers change each year, so check the pricing page."].join("\n\n");
    const chunks = chunkText(text, 400);
    expect(chunks.every((chunk) => chunk.length <= 400)).toBe(true);
    const best = rankChunks(chunks, "pricing free tier", 500);
    expect(best.join(" ")).toMatch(/managed plan costs 70/);
    expect(best.join("").length).toBeLessThanOrEqual(500);
  });
});

describe("JSON from model text", () => {
  test("finds the answer after reasoning text and in a code fence", () => {
    expect(jsonCandidates('Thinking {not json} ... final: {"a": 1, "b": "x}"}')[0]).toEqual({ a: 1, b: "x}" });
    expect(jsonCandidates('```json\n{"plan": [1, 2]}\n```')[0]).toEqual({ plan: [1, 2] });
    expect(jsonCandidates("no json here")).toEqual([]);
  });
});

describe("model selection by env", () => {
  test("a role value wins over the global value; bad and blocked entries are skipped", () => {
    const overrides = modelOverrides({
      OPENROUTER_MODELS: "openrouter/free, not a model,, qwen/qwen3.8-27b:free nvidia/nemotron-3.5-lightning:free openrouter/free",
      OPENROUTER_MODELS_WRITER: "google/gemma-4-31b-it:free",
    });
    expect(overrides.researcher).toEqual(["openrouter/free", "nvidia/nemotron-3.5-lightning:free"]);
    expect(overrides.writer).toEqual(["google/gemma-4-31b-it:free"]);
    expect(effectiveChains("fast", overrides).assembler).toEqual(["openrouter/free", "nvidia/nemotron-3.5-lightning:free"]);
    expect(modelOverrides({})).toEqual({});
    expect(effectiveChains("balanced", {}).researcher.at(-1)).toBe("openrouter/free");
    for (const chain of [...Object.values(MODEL_PRESETS.balanced), ...Object.values(MODEL_PRESETS.fast)]) {
      expect(chain.some((id) => BLOCKED_MODELS.has(id))).toBe(false);
    }
  });
});
