"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function detectMac(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** True on macOS and iOS. The server render uses false ("Ctrl"). */
export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, detectMac, () => false);
}

/** "⌘" on macOS, "Ctrl" elsewhere (design §7). */
export function useModKey(): string {
  return useIsMac() ? "⌘" : "Ctrl";
}

/** Keyboard label for a shortcut: "⌘K" on macOS, "Ctrl K" elsewhere. */
export function useShortcutLabel(key: string): string {
  const isMac = useIsMac();
  return isMac ? `⌘${key.toUpperCase()}` : `Ctrl ${key.toUpperCase()}`;
}
