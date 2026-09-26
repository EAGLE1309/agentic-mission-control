"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { toastTimeout } from "./finish-toasts";
import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error) throw error;
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setPending(false);
      const title = "Sign-out did not complete. Check your connection, then try again.";
      toast.add({ title, timeout: toastTimeout(title) });
    }
  }

  return { signOut, pending };
}
