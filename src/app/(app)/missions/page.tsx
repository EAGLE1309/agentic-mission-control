import type { Metadata } from "next";
import { MissionsView } from "@/features/missions/missions-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "Missions" };

export default function MissionsPage() {
  return (
    <>
      <TopBar title="Missions" />
      <MissionsView />
    </>
  );
}
