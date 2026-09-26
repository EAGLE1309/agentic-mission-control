import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages. Sign-in is `noindex`, and the app needs a session. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/sign-up`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
