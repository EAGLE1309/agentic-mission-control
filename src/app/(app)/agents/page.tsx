import type { Metadata } from "next";
import { AgentsView } from "@/features/catalog/agents-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <TopBar title="Agents" />
      <AgentsView />
    </>
  );
}
