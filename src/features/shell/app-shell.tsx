"use client";

import type { api } from "@convex/_generated/api";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import type { Preloaded } from "convex/react";
import { Suspense, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AuthGuard } from "./auth-guard";
import { CommandPalette } from "./command-palette";
import { FinishToasts } from "./finish-toasts";
import { ShellProvider } from "./shell-context";

export function AppShell({
  preloadedUser,
  defaultSidebarOpen,
  children,
}: {
  preloadedUser: Preloaded<typeof api.auth.getCurrentUser>;
  defaultSidebarOpen: boolean;
  children: ReactNode;
}) {
  const user = usePreloadedAuthQuery(preloadedUser);

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <ShellProvider>
        <a
          href="#main"
          className="sr-only rounded-md bg-background px-3 py-2 text-sm text-foreground shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>
        <Suspense fallback={null}>
          <AuthGuard />
        </Suspense>
        <AppSidebar user={user} />
        <SidebarInset id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </SidebarInset>
        <CommandPalette />
        <FinishToasts />
      </ShellProvider>
    </SidebarProvider>
  );
}
