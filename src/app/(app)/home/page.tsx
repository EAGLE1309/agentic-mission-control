import type { Metadata } from "next";
import { HomeView } from "@/features/composer/home-view";
import { TopBar } from "@/features/shell/top-bar";

export const metadata: Metadata = { title: "New mission" };

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const { template } = await searchParams;
  const templateId = typeof template === "string" ? template : null;
  return (
    <>
      <TopBar title="New mission" titleAs="p" />
      {/* A new template from the palette remounts the view with its goal. */}
      <HomeView key={templateId ?? "blank"} templateId={templateId} />
    </>
  );
}
