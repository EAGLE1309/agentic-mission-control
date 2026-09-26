import type { Metadata } from "next";
import { UsageView } from "@/features/usage/usage-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Usage" };

export default function UsagePage() {
  return (
    <>
      <TopBar title="Usage" />
      <UsageView />
    </>
  );
}
