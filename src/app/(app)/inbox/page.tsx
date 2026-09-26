import type { Metadata } from "next";
import { InboxView } from "@/features/inbox/inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <InboxView />;
}
