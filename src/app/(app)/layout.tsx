import { api } from "@convex/_generated/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { AppShell } from "@/features/shell/app-shell";
import { getToken, preloadAuthQuery } from "@/lib/auth-server";
import { PATH_HEADER, signInHref } from "@/lib/safe-next";

// The real session check (tech spec §10). proxy.ts only looks for the cookie.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = await getToken();
  if (!token) {
    const path = (await headers()).get(PATH_HEADER);
    redirect(signInHref(path));
  }

  const [preloadedUser, cookieStore] = await Promise.all([preloadAuthQuery(api.auth.getCurrentUser), cookies()]);
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <ConvexClientProvider initialToken={token}>
      <AppShell preloadedUser={preloadedUser} defaultSidebarOpen={defaultSidebarOpen}>
        {children}
      </AppShell>
    </ConvexClientProvider>
  );
}
