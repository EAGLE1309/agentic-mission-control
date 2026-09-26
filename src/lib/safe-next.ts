export const DEFAULT_APP_PATH = "/home";

/** proxy.ts puts the requested path here, so the (app) layout can build the sign-in link. */
export const PATH_HEADER = "x-mc-path";

const AUTH_PATHS = ["/sign-in", "/sign-up", "/api/"];

/**
 * The page to open after sign-in (FR-3). Only a path on this site is allowed,
 * so `next=//evil.com` or `next=https://evil.com` cannot redirect off the site.
 */
export function safeNextPath(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_APP_PATH;
  let url: URL;
  try {
    url = new URL(raw, "http://local.invalid");
  } catch {
    return DEFAULT_APP_PATH;
  }
  if (url.origin !== "http://local.invalid") return DEFAULT_APP_PATH;
  if (url.pathname === "/" || AUTH_PATHS.some((path) => url.pathname.startsWith(path))) return DEFAULT_APP_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in URL that returns to `path` after sign-in. */
export function signInHref(path: string | null | undefined): string {
  const next = safeNextPath(path);
  return next === DEFAULT_APP_PATH ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}
