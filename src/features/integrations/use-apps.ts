"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { toastTimeout } from "@/features/shell/finish-toasts";
import { APPS, appSpec, isAppSlug, type AppSlug } from "@/shared/apps";
import { errorCode } from "@/shared/errors";

// Third-party apps through Composio (design §6.8). Connect goes to the Composio
// page of the app, which comes back to /integrations?app=…&status=…. The page
// then syncs from Composio: the URL is never trusted as proof.

const APP_NAME = new Map<string, string>(APPS.map((app) => [app.slug, app.name]));

function notify(title: string) {
  toast.add({ title, timeout: toastTimeout(title) });
}

function failure(error: unknown, fallback: string): string {
  if (errorCode(error) === "APP_NOT_CONFIGURED") return "Composio is not set up for this deployment.";
  return fallback;
}

export function useApps(composio: boolean | undefined) {
  const rows = useQuery(api.apps.connections);
  const connectAction = useAction(api.composio.connect);
  const disconnectAction = useAction(api.composio.disconnect);
  const syncAction = useAction(api.composio.sync);
  // The chips change at once; the server confirms, or they flip back on an error.
  const setAccessMutation = useMutation(api.apps.setAccess).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.apps.connections, {});
    if (current) {
      store.setQuery(
        api.apps.connections,
        {},
        current.map((row) => (row.toolkit === args.toolkit ? { ...row, read: args.read, write: args.write } : row)),
      );
    }
  });
  const router = useRouter();
  const [busy, setBusy] = useState<AppSlug | null>(null);
  const synced = useRef(false);

  // Sync once when the page opens, and report the result of a Connect return.
  useEffect(() => {
    if (!composio || synced.current) return;
    synced.current = true;
    const params = new URLSearchParams(window.location.search);
    const app = params.get("app");
    const result = params.get("status");
    if (app !== null) router.replace("/integrations", { scroll: false });
    syncAction({})
      .then(() => {
        if (app === null || !isAppSlug(app)) return;
        const name = APP_NAME.get(app) ?? app;
        notify(result === "success" ? `${name} is connected` : `${name} was not connected. Try again.`);
      })
      .catch((error: unknown) => {
        if (app !== null) notify(failure(error, "The app connections did not load. Try again."));
      });
  }, [composio, router, syncAction]);

  const connect = async (slug: AppSlug) => {
    setBusy(slug);
    try {
      const { redirectUrl } = await connectAction({ toolkit: slug });
      window.location.assign(redirectUrl);
    } catch (error) {
      setBusy(null);
      notify(failure(error, `${APP_NAME.get(slug) ?? slug} did not open. Try again.`));
    }
  };

  const disconnect = async (slug: AppSlug) => {
    setBusy(slug);
    try {
      await disconnectAction({ toolkit: slug });
      notify(`${APP_NAME.get(slug) ?? slug} is disconnected`);
    } catch (error) {
      notify(failure(error, `${APP_NAME.get(slug) ?? slug} was not disconnected. Try again.`));
    } finally {
      setBusy(null);
    }
  };

  /** Turn search or creating items on or off for one app. */
  const setAccess = async (slug: AppSlug, next: { read: boolean; write: boolean }) => {
    try {
      await setAccessMutation({ toolkit: slug, ...next });
    } catch {
      notify(`The access of ${APP_NAME.get(slug) ?? slug} did not change. Try again.`);
    }
  };

  const connected = new Set((rows ?? []).map((row) => row.toolkit).filter(isAppSlug));
  const access = new Map<AppSlug, { read: boolean; write: boolean }>();
  for (const row of rows ?? []) {
    if (!isAppSlug(row.toolkit)) continue;
    const spec = appSpec(row.toolkit);
    access.set(row.toolkit, { read: spec.search && row.read, write: spec.write !== undefined && row.write });
  }
  const counts = {
    read: [...access.values()].filter((item) => item.read).length,
    write: [...access.values()].filter((item) => item.write).length,
  };
  return { connected, access, counts, loading: rows === undefined, busy, connect, disconnect, setAccess };
}
