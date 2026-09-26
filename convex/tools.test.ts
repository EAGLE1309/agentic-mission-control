import { describe, expect, test } from "vitest";
import { jsonCandidates } from "./engine/llm/json";
import { chunkText, rankChunks } from "./engine/tools/bm25";
import { htmlToText } from "./engine/tools/html";
import { checkUrlShape, isBlockedAddress } from "./engine/tools/ssrf";
import { BLOCKED_MODELS, MODEL_PRESETS, effectiveChains, modelOverrides } from "../src/shared/models";
import { APPS } from "../src/shared/apps";
import { SEARCH_ACTIONS, WRITE_ACTIONS, formatCreated, formatSearch, notionPageId } from "./engine/tools/appActions";
import { SAVE_ID, flowEdges, validatePlan } from "../src/shared/plan";
import { reduceEvents } from "../src/shared/reducer";
import { configuredServices, formatHits, parseHits, searchInOrder, type SearchHit } from "./engine/tools/search";

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

describe("librarian app actions", () => {
  test("the action catalog matches what the Integrations page says each app can do", () => {
    expect(Object.keys(SEARCH_ACTIONS).sort()).toEqual(APPS.filter((app) => app.search).map((app) => app.slug).sort());
    expect(Object.keys(WRITE_ACTIONS).sort()).toEqual(APPS.filter((app) => "write" in app && app.write).map((app) => app.slug).sort());
  });

  test("results become numbered items with links; a create needs a valid target", () => {
    const notion = {
      results: [
        { id: "page-1", url: "https://www.notion.so/Pricing-notes-1", properties: { title: { title: [{ plain_text: "Pricing notes" }] } } },
      ],
    };
    const found = formatSearch("notion", "Notion", "pricing", notion);
    expect(found.text).toContain("1. Pricing notes");
    expect(found.text).toContain("URL: https://www.notion.so/Pricing-notes-1");
    expect(found.text).toContain("ID: page-1");
    expect(found.sources).toEqual([{ title: "Pricing notes", url: "https://www.notion.so/Pricing-notes-1" }]);
    expect(formatSearch("slack", "Slack", "x", { messages: { matches: [] } }).sources).toEqual([]);

    expect(WRITE_ACTIONS.github?.args({ title: "T", content: "C", target: "acme/app" })).toEqual({
      ok: true,
      args: { owner: "acme", repo: "app", title: "T", body: "C" },
    });
    expect(WRITE_ACTIONS.github?.args({ title: "T", content: "C", target: "not a repo" }).ok).toBe(false);
    expect(WRITE_ACTIONS.notion?.args({ title: "T", content: "C" }).ok).toBe(false);
    expect(formatSearch("notion", "Notion", "x", notion, "No Notion page title matches.").text).toMatch(/^No Notion page title matches\.\n1\. Pricing notes/);
    expect(formatCreated("googledocs", "Google Docs", "Brief", { documentId: "d1", document_url: "https://docs.google.com/document/d/d1/edit" }).sources).toEqual([
      { title: "Brief", url: "https://docs.google.com/document/d/d1/edit" },
    ]);
  });

  test("a Notion target can be an ID, a link, or a title", () => {
    expect(notionPageId("3e7df692-c01e-802c-9eb7-fabc2eb96622")).toBe("3e7df692-c01e-802c-9eb7-fabc2eb96622");
    expect(notionPageId("3E7DF692C01E802C9EB7FABC2EB96622")).toBe("3e7df692c01e802c9eb7fabc2eb96622");
    expect(notionPageId("https://app.notion.com/p/Testing-3e7df692c01e802c9eb7fabc2eb96622?pvs=4")).toBe("3e7df692c01e802c9eb7fabc2eb96622");
    expect(notionPageId("Research notes")).toBeNull();
  });
});

describe("save step", () => {
  const nodes = [
    { id: "orchestrator", role: "orchestrator" as const, dependsOn: [] },
    { id: "pricing", role: "researcher" as const, dependsOn: [] },
    { id: "assembler", role: "assembler" as const, dependsOn: [] },
    { id: "report", role: "report" as const, dependsOn: [] },
    { id: SAVE_ID, role: "librarian" as const, dependsOn: ["report"] },
  ];

  test("the save node comes after the report, never before the assembler", () => {
    const edges = flowEdges(nodes).map((edge) => edge.id);
    expect(edges).toContain("report->save");
    expect(edges).not.toContain("save->assembler");
    expect(edges).not.toContain("orchestrator->save");
    expect(validatePlan([{ id: "save", role: "researcher", title: "T", instructions: "I", dependsOn: [] }, { id: "b", role: "researcher", title: "T", instructions: "I", dependsOn: [] }])).toContainEqual(
      expect.stringMatching(/reserved/),
    );
  });

  test("a plan with saveTo adds the save node to the view", () => {
    const base = { missionId: "m" as never, at: 1 };
    const view = reduceEvents([
      { ...base, seq: 1, type: "mission_created", payload: { goal: "G", modelProfile: "balanced", mode: "simulated" } },
      {
        ...base,
        seq: 2,
        type: "plan_created",
        nodeId: "orchestrator",
        payload: {
          title: "T",
          rationale: "R",
          nodes: [{ id: "pricing", role: "researcher", title: "Pricing", instructions: "I", dependsOn: [] }],
          saveTo: { app: "notion" },
        },
      },
    ]);
    expect(view.nodes[SAVE_ID]).toMatchObject({ role: "librarian", title: "Save the report to Notion", dependsOn: ["report"] });
    expect(view.nodeOrder.at(-1)).toBe(SAVE_ID);
  });
});

describe("web search services", () => {
  test("the answer of each service becomes hits with links", () => {
    const linkup = {
      results: [
        { type: "text", name: "Pinecone  pricing", url: "https://pinecone.io/pricing", content: "Starter plan\n is free." },
        { type: "image", name: "Chart", url: "https://pinecone.io/chart.png" },
        { name: "No link", content: "x" },
      ],
    };
    expect(parseHits("linkup", linkup)).toEqual([{ title: "Pinecone pricing", url: "https://pinecone.io/pricing", snippet: "Starter plan is free." }]);
    expect(parseHits("exa", { results: [{ title: null, url: "https://exa.ai/docs", highlights: ["One.", "", "Two."] }] })).toEqual([
      { title: "https://exa.ai/docs", url: "https://exa.ai/docs", snippet: "One. … Two." },
    ]);
    expect(parseHits("tavily", { results: [{ title: "Bad", url: "javascript:alert(1)" }, { title: "T", url: "https://t.dev", content: "x" }] })).toHaveLength(1);
    expect(parseHits("exa", { error: "NO_MORE_CREDITS" })).toBeNull();
    expect(formatHits(parseHits("linkup", linkup) ?? [])).toBe("1. Pinecone pricing\n   URL: https://pinecone.io/pricing\n   Starter plan is free.");
  });

  test("a service that is out of searches or fails passes the query to the next one", async () => {
    const services = configuredServices({ LINKUP_API_KEY: "l", EXA_API_KEY: "  ", TAVILY_API_KEY: "t" });
    expect(services.map((item) => item.service)).toEqual(["linkup", "tavily"]);
    const hit: SearchHit = { title: "T", url: "https://t.dev", snippet: "" };

    const taken: string[] = [];
    const moved = await searchInOrder(services, "q", {
      take: async (service) => (taken.push(service), true),
      call: async (service) => (service === "linkup" ? { ok: false, error: "returned HTTP 429" } : { ok: true, hits: [hit] }),
    });
    expect(moved).toEqual({ ok: true, service: "tavily", hits: [hit] });
    expect(taken).toEqual(["linkup", "tavily"]);

    const empty = await searchInOrder(services, "q", { take: async () => true, call: async () => ({ ok: true, hits: [] }) });
    expect(empty).toEqual({ ok: true, service: "linkup", hits: [] });

    const capped = await searchInOrder(services, "q", {
      take: async () => false,
      call: async () => {
        throw new Error("a capped service is not called");
      },
    });
    expect(capped.ok ? "" : capped.error).toMatch(/daily search limit/);

    const failed = await searchInOrder(services, "q", {
      take: async (service) => service === "linkup",
      call: async () => ({ ok: false, error: "did not answer in time" }),
    });
    expect(failed.ok ? "" : failed.error).toMatch(/^Search failed: Linkup did not answer in time\. Use fetch_url/);

    const none = await searchInOrder([], "q", { take: async () => true, call: async () => ({ ok: true, hits: [hit] }) });
    expect(none.ok ? "" : none.error).toMatch(/not set up/);
  });
});
