import type { Metadata } from "next";
import { ToolsView } from "@/features/catalog/tools-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <>
      <TopBar title="Tools" />
      <ToolsView />
    </>
  );
}
