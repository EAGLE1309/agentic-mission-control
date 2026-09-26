import { api } from "@convex/_generated/api";
import type { Metadata } from "next";
import { MissionNotFound } from "@/features/run/run-error-boundary";
import { RunView } from "@/features/run/run-view";
import { TopBar } from "@/features/shell/top-bar";
import { preloadAuthQuery } from "@/lib/auth-server";
import { errorCode } from "@/shared/errors";

export const metadata: Metadata = { title: "Mission" };

// First paint (tech spec §9.4): the server preloads the mission, so the goal
// and the status show before the events arrive.
export default async function MissionPage({ params }: PageProps<"/missions/[id]">) {
  const { id } = await params;
  let preloaded;
  try {
    preloaded = await preloadAuthQuery(api.missions.get, { missionId: id });
  } catch (error) {
    if (errorCode(error) !== "NOT_FOUND") throw error;
    return (
      <>
        <TopBar crumbs={[{ label: "Missions", href: "/missions" }, { label: "Not found" }]} />
        <MissionNotFound />
      </>
    );
  }
  return <RunView preloadedMission={preloaded} />;
}
