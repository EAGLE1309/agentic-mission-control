import type { AgentRole } from "../../../src/shared/agents";
import type { Source } from "../../../src/shared/events";
import { estimateTokens, seededRandom, sleep, type Random } from "../random";
import type {
  LlmClient,
  LlmMessage,
  ObjectArgs,
  ObjectResult,
  SimContext,
  StepArgs,
  StepResult,
  ToolCallRequest,
} from "./types";

// Simulated mode (FR-31, tech spec §7.7). It acts like a model: it plans,
// calls tools, and writes text with realistic delays. It is deterministic for
// a seed, and it never calls OpenRouter or Tavily.

const RESEARCH_TASKS = [
  {
    id: "background",
    title: "Background and context",
    instructions: (goal: string) =>
      `Find the background for this goal: ${goal}\nExplain the key terms and why the topic matters.`,
  },
  {
    id: "options",
    title: "Main options and players",
    instructions: (goal: string) =>
      `Find the main options, products, or players for this goal: ${goal}\nNote what makes each one different.`,
  },
  {
    id: "evidence",
    title: "Recent data and evidence",
    instructions: (goal: string) =>
      `Find recent numbers, benchmarks, or news for this goal: ${goal}\nPrefer sources from the last 12 months.`,
  },
  {
    id: "tradeoffs",
    title: "Costs and tradeoffs",
    instructions: (goal: string) => `Find the costs, risks, and tradeoffs for this goal: ${goal}`,
  },
] as const;

/** The first line of the goal, shortened, for titles and queries. */
export function subjectOf(goal: string): string {
  const line = goal.split("\n").find((part) => part.trim())?.trim() ?? "the goal";
  const clean = line.replace(/[.?!:;]+$/, "");
  const words = clean.split(/\s+/).slice(0, 9).join(" ");
  return words.length > 60 ? `${words.slice(0, 59).trimEnd()}…` : words;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


/** Stream text in about 60 chunks, so long text still finishes in a few seconds. */
async function streamText(text: string, onDelta: ((delta: string) => void) | undefined, rng: Random) {
  if (!onDelta || !text) return;
  const words = text.split(/(?<=\s)/);
  const size = Math.max(1, Math.ceil(words.length / 60));
  for (let i = 0; i < words.length; i += size) {
    onDelta(words.slice(i, i + size).join(""));
    await sleep(rng.int(20, 55));
  }
}

function inputTokens(system: string, messages: LlmMessage[]): number {
  const text = messages
    .map((message) =>
      message.role === "tool"
        ? message.results.map((result) => result.output).join("\n")
        : message.role === "assistant"
          ? message.content + JSON.stringify(message.toolCalls)
          : message.content,
    )
    .join("\n");
  return estimateTokens(system + text);
}

/** Parse the sources out of simulated tool outputs. */
function sourcesFrom(messages: LlmMessage[]): Source[] {
  const found = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "tool") continue;
    for (const result of message.results) {
      if (result.isError) continue;
      for (const match of result.output.matchAll(/^(?:\d+\. |Title: )(.+)\n\s*URL: (\S+)/gm)) {
        if (!found.has(match[2])) found.set(match[2], match[1].trim());
      }
    }
  }
  return [...found].map(([url, title]) => ({ url, title }));
}

function lastToolResult(messages: LlmMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "tool") return message.results.at(-1);
  }
  return undefined;
}

function sectionMarkdown(title: string, subject: string, sources: Source[], rng: Random): string {
  const link = (index: number) => {
    const source = sources[index % Math.max(1, sources.length)];
    return source ? `[${source.title}](${source.url})` : "the sources";
  };
  const points = [
    `Most teams start with a small pilot before they commit to one approach for ${subject.toLowerCase()} (${link(0)}).`,
    `Cost depends more on usage patterns than on list prices, so estimates need real workloads (${link(1)}).`,
    `The options differ most in setup effort, ecosystem support, and how well they scale (${link(2)}).`,
    `Recent reports show fast change in this area, so facts older than a year need a check (${link(0)}).`,
  ];
  const chosen = points.filter(() => rng.chance(0.75)).slice(0, 3);
  return [
    `### ${title}`,
    "",
    `This section covers ${title.toLowerCase()} for ${subject.toLowerCase()}. The sources agree on the main points, but they differ on the details.`,
    "",
    ...(chosen.length > 0 ? chosen : points.slice(0, 2)).map((point) => `- ${point}`),
    "",
    `In short: compare the options on a real use case before you decide, and keep the decision easy to change.`,
  ].join("\n");
}

function reportMarkdown(sim: SimContext): string {
  const title = sim.planTitle ?? capitalize(subjectOf(sim.goal));
  const inputs = sim.inputs ?? [];
  const summary = `This report answers the goal: ${subjectOf(sim.goal).toLowerCase()}. It combines ${inputs.length} ${
    inputs.length === 1 ? "task" : "tasks"
  } of research and analysis, and it links each fact to its source.`;
  const sections = inputs.map((input) =>
    [`## ${input.title}`, "", input.markdown.replace(/^###\s+.+\n+/, "").trim()].join("\n"),
  );
  return [`# ${title}`, "", summary, "", ...sections.flatMap((section) => [section, ""])].join("\n").trim();
}

function revisedReport(sim: SimContext): string {
  const previous = sim.previousReport?.trim() || reportMarkdown(sim);
  const lines = previous.split("\n");
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  const change = `> This version applies your change: ${sim.instruction ?? "no instruction"}.`;
  lines.splice(titleIndex + 1, 0, "", change);
  return lines.join("\n");
}

export function createSimulatedClient(): LlmClient {
  return {
    mode: "simulated",

    modelFor(role: AgentRole) {
      return `simulated/${role}`;
    },

    async object<T>(args: ObjectArgs<T>): Promise<ObjectResult<T>> {
      await args.acquire();
      const rng = seededRandom(args.sim.seed);
      const started = Date.now();
      await sleep(rng.int(900, 1800));

      const goal = args.sim.goal;
      const count = rng.int(2, 3);
      const research = [...RESEARCH_TASKS].sort(() => rng.next() - 0.5).slice(0, count);
      const withWriter = rng.chance(0.7);
      const nodes: { id: string; role: "researcher" | "writer"; title: string; instructions: string; dependsOn: string[] }[] =
        research.map((task) => ({
          id: task.id,
          role: "researcher",
          title: task.title,
          instructions: task.instructions(goal),
          dependsOn: [],
        }));
      if (withWriter) {
        nodes.push({
          id: "synthesis",
          role: "writer",
          title: "Compare and recommend",
          instructions: `Combine the research into a comparison and a recommendation for this goal: ${goal}`,
          dependsOn: research.map((task) => task.id),
        });
      }
      // The first attempt sometimes has a mistake, so the repair path runs too.
      if (args.sim.seed.endsWith(":1") && rng.chance(0.15)) nodes[1] = { ...nodes[1], id: nodes[0].id };

      const plan = {
        title: capitalize(subjectOf(goal)),
        rationale: `Split the goal into ${count} research tasks that run in parallel${
          withWriter ? ", then one writing task that combines them" : ""
        }.`,
        nodes,
      };
      const object = args.schema.parse(plan);
      return {
        object,
        usage: { inputTokens: estimateTokens(args.system + args.prompt), outputTokens: estimateTokens(JSON.stringify(plan)) },
        model: this.modelFor(args.role),
        latencyMs: Math.round(Date.now() - started),
      };
    },

    async step(args: StepArgs): Promise<StepResult> {
      await args.acquire();
      const { sim, messages } = args;
      const round = messages.filter((message) => message.role === "assistant").length;
      const rng = seededRandom(`${sim.seed}:${round}`);
      const started = Date.now();
      await sleep(rng.int(500, 1400));

      const subject = subjectOf(sim.goal);
      const toolNames = new Set(args.tools.map((tool) => tool.name));
      const call = (name: string, input: unknown): ToolCallRequest => ({ id: `${sim.seed}:${round}:${name}`, name, input });
      let text = "";
      let toolCalls: ToolCallRequest[] = [];

      if (args.role === "assembler") {
        text = sim.instruction ? revisedReport(sim) : reportMarkdown(sim);
      } else if (args.role === "writer" || !toolNames.has("web_search")) {
        const inputs = sim.inputs ?? [];
        const sources = args.role === "writer" ? inputs.flatMap((input) => input.sources) : sourcesFrom(messages);
        text = args.role === "writer" ? "I have the research outputs. I will combine them into one comparison." : "I have enough facts. I will write the section.";
        const title = sim.task?.title ?? "Findings";
        const markdown =
          args.role === "writer" && inputs.length > 0
            ? [
                `### ${title}`,
                "",
                "| Task | Main point |",
                "| --- | --- |",
                ...inputs.map((input) => `| ${input.title} | ${input.markdown.split("\n").find((line) => line.startsWith("- "))?.slice(2, 120) ?? "See the section."} |`),
                "",
                `Recommendation: start with the option that fits the current team and workload, and review it after the first month.`,
              ].join("\n")
            : sectionMarkdown(title, subject, sources, rng);
        toolCalls = [call("write_section", { title, markdown, sources: sources.slice(0, 8) })];
      } else {
        const last = lastToolResult(messages);
        const searches = messages.filter(
          (message) => message.role === "assistant" && message.toolCalls.some((toolCall) => toolCall.name === "web_search"),
        ).length;
        const reads = messages.filter(
          (message) => message.role === "assistant" && message.toolCalls.some((toolCall) => toolCall.name === "fetch_url"),
        ).length;
        const firstUrl = last && !last.isError ? /URL: (\S+)/.exec(last.output)?.[1] : undefined;
        const taskTitle = (sim.task?.title ?? "the topic").toLowerCase();

        if (last?.isError && searches < 3) {
          text = "That call failed. I will try a shorter query.";
          const variants = ["overview", "guide", "comparison"];
          toolCalls = [call("web_search", { query: `${subject.split(" ").slice(0, 4).join(" ")} ${variants[searches % variants.length]}` })];
        } else if (searches === 0) {
          text = `I will search for ${taskTitle} of ${subject.toLowerCase()}.`;
          toolCalls = [call("web_search", { query: `${taskTitle} ${subject}`.slice(0, 200) })];
        } else if (reads === 0 && firstUrl) {
          text = "The first result looks relevant. I will read it.";
          toolCalls = [call("fetch_url", { url: firstUrl, focus: sim.task?.title })];
        } else if (searches === 1 && rng.chance(0.5)) {
          text = "I need one more source with recent data.";
          toolCalls = [call("web_search", { query: `${subject} recent data`.slice(0, 200) })];
        } else {
          const sources = sourcesFrom(messages);
          text = "I have enough facts. I will write the section.";
          toolCalls = [
            call("write_section", {
              title: sim.task?.title ?? "Findings",
              markdown: sectionMarkdown(sim.task?.title ?? "Findings", subject, sources, rng),
              sources: sources.slice(0, 8),
            }),
          ];
        }
      }

      await streamText(text, args.onDelta, rng);
      return {
        text,
        toolCalls,
        usage: {
          inputTokens: inputTokens(args.system, messages),
          outputTokens: estimateTokens(text + JSON.stringify(toolCalls)),
        },
        model: this.modelFor(args.role),
        latencyMs: Math.round(Date.now() - started),
      };
    },
  };
}

