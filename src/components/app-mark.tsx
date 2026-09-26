import Airtable from "@thesvg/react/airtable";
import Asana from "@thesvg/react/asana";
import Clickup from "@thesvg/react/clickup";
import Discord from "@thesvg/react/discord";
import Dropbox from "@thesvg/react/dropbox";
import Figma from "@thesvg/react/figma";
import Github from "@thesvg/react/github";
import Gitlab from "@thesvg/react/gitlab";
import Gmail from "@thesvg/react/gmail";
import GoogleCalendar from "@thesvg/react/google-calendar";
import GoogleDocs from "@thesvg/react/google-docs";
import GoogleDrive from "@thesvg/react/google-drive";
import Hubspot from "@thesvg/react/hubspot";
import Jira from "@thesvg/react/jira";
import Linear from "@thesvg/react/linear";
import Notion from "@thesvg/react/notion";
import Slack from "@thesvg/react/slack";
import { cn } from "@/lib/utils";
import type { AppSlug } from "@/shared/apps";

// Marks of the third-party apps (design §4.1), in their original colors. A
// mark that is black in its brand (GitHub, Notion) uses mono and the text
// color, so it shows in dark mode. The Integrations page and the app tool rows use it.

export function AppMark({ slug, className }: { slug: AppSlug; className?: string }) {
  const size = cn("size-5 shrink-0", className);
  const mono = cn(size, "text-foreground");
  switch (slug) {
    case "slack":
      return <Slack variant="default" aria-hidden className={size} />;
    case "gmail":
      return <Gmail variant="default" aria-hidden className={size} />;
    case "discord":
      return <Discord variant="default" aria-hidden className={size} />;
    case "notion":
      return <Notion variant="mono" aria-hidden className={mono} />;
    case "googledrive":
      return <GoogleDrive variant="default" aria-hidden className={size} />;
    case "googledocs":
      return <GoogleDocs variant="default" aria-hidden className={size} />;
    case "dropbox":
      return <Dropbox variant="default" aria-hidden className={size} />;
    case "github":
      return <Github variant="mono" aria-hidden className={mono} />;
    case "gitlab":
      return <Gitlab variant="default" aria-hidden className={size} />;
    case "linear":
      return <Linear variant="default" aria-hidden className={size} />;
    case "jira":
      return <Jira variant="default" aria-hidden className={size} />;
    case "googlecalendar":
      return <GoogleCalendar variant="default" aria-hidden className={size} />;
    case "clickup":
      return <Clickup variant="default" aria-hidden className={size} />;
    case "asana":
      return <Asana variant="default" aria-hidden className={size} />;
    case "airtable":
      return <Airtable variant="default" aria-hidden className={size} />;
    case "figma":
      return <Figma variant="default" aria-hidden className={size} />;
    case "hubspot":
      return <Hubspot variant="default" aria-hidden className={size} />;
  }
}
