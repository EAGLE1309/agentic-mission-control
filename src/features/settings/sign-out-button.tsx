"use client";

import { IconLogout } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSignOut } from "@/features/shell/use-sign-out";

export function SignOutButton() {
  const { signOut, pending } = useSignOut();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => void signOut()}>
      {pending ? <Spinner data-icon="inline-start" /> : <IconLogout data-icon="inline-start" />}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
