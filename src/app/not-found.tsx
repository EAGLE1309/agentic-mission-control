import { IconFileText } from "@tabler/icons-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-4">
      <EmptyState
        icon={IconFileText}
        title="Page not found"
        description="The link is wrong, or the page moved."
        action={
          <Button size="sm" render={<Link href="/home" />}>
            Go to Mission Control
          </Button>
        }
      />
    </main>
  );
}
