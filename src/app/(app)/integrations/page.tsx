import type { Metadata } from "next";
import { IntegrationsView } from "@/features/integrations/integrations-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <>
      <TopBar title="Integrations" />
      <IntegrationsView />
    </>
  );
}
