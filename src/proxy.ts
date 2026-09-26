import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER, signInHref } from "@/lib/safe-next";

// Optimistic check only (tech spec §10): no database read. The (app) layout
// checks the real session. Auth pages are not redirected here, because an
// expired cookie would bounce between sign-in and the app.
export function proxy(request: NextRequest) {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(signInHref(path), request.url));
  }
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/home/:path*",
    "/missions/:path*",
    "/inbox/:path*",
    "/templates/:path*",
    "/integrations/:path*",
    "/agents/:path*",
    "/usage/:path*",
    "/settings/:path*",
  ],
};
