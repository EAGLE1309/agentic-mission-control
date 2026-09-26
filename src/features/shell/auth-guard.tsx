"use client";

import { useConvexAuth } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { signInHref } from "@/lib/safe-next";

/**
 * The session can end while the app is open (sign-out in another tab, or an
 * expired session). Then go to sign-in and return here after (FR-3).
 */
export function AuthGuard() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const query = searchParams.toString();
    router.replace(signInHref(query ? `${pathname}?${query}` : pathname));
  }, [isLoading, isAuthenticated, pathname, router, searchParams]);

  return null;
}
