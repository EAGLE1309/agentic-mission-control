// Mission templates (FR-10). A template fills the composer. It does not send.

export type Template = {
  id: string;
  title: string;
  goal: string;
};

export const TEMPLATES: readonly Template[] = [
  {
    id: "compare-tools",
    title: "Compare three tools for a use case",
    goal: "Compare three popular open-source vector databases for a small RAG app. Cover pricing, hosting options, performance, and developer experience. End with a recommendation.",
  },
  {
    id: "news-summary",
    title: "Summarize recent news on a topic",
    goal: "Summarize the most important news about AI agent frameworks from the last 30 days. Group the news by theme and link each source.",
  },
  {
    id: "market-map",
    title: "Map a market",
    goal: "Map the market for AI note-taking apps: the main products, their pricing, and how they differ. Include a comparison table.",
  },
  {
    id: "explain-concept",
    title: "Explain a technical concept",
    goal: "Explain how retrieval-augmented generation works for a product manager. Cover the steps, the common failure modes, and how teams measure quality.",
  },
  {
    id: "company-profile",
    title: "Research a company",
    goal: "Research the company Vercel: what it sells, its business model, its recent launches, and its main competitors.",
  },
  {
    id: "decision-brief",
    title: "Write a decision brief",
    goal: "Should a five-person startup use Postgres or a managed document database for its first product? Give the tradeoffs and a recommendation.",
  },
];

export function findTemplate(id: string | null | undefined): Template | undefined {
  return id ? TEMPLATES.find((template) => template.id === id) : undefined;
}
