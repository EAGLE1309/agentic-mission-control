import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The app pages need a session (proxy.ts matcher), so crawlers skip them and the API. */
const PRIVATE_PATHS = [
  "/api/",
  "/home",
  "/missions",
  "/inbox",
  "/templates",
  "/integrations",
  "/agents",
  "/usage",
  "/settings",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
