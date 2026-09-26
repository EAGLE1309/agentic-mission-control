import { IconApps } from "@tabler/icons-react";
import { AppMark } from "@/components/app-mark";
import { BrandMark } from "@/components/provider-mark";
import { StatusIcon } from "@/components/status";
import { APPS } from "@/shared/apps";

// The apps the Librarian can search, and the ones where it can create items
// (src/shared/apps.ts). Agents never edit or delete outside the app (PRD §3).

const SEARCHABLE = APPS.filter((app) => app.search);
type App = (typeof APPS)[number];
const WRITABLE = APPS.filter((app): app is Extract<App, { write: object }> => "write" in app);

export function AppsPanels() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-raised">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Search</h3>
          <p className="text-sm text-muted-foreground">Read only. On by default for each app you connect.</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {SEARCHABLE.map((app) => (
            <li key={app.slug} className="flex h-8 items-center gap-2 rounded-full bg-muted/70 pr-3 pl-2 text-sm text-foreground">
              <AppMark slug={app.slug} className="size-4" />
              {app.name}
            </li>
          ))}
        </ul>
        {/* One app_search call, as the trace shows it. */}
        <div
          role="img"
          aria-label="Example: the Librarian searches Notion for RAG evaluation notes and finds 4 pages."
          className="pointer-events-none mt-auto flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-2 text-xs select-none"
        >
          <IconApps aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-mono text-foreground">app_search</span>
          <AppMark slug="notion" className="size-3.5" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">RAG evaluation notes</span>
          <span className="shrink-0 text-muted-foreground">4 pages</span>
          <StatusIcon status="ok" className="size-3.5" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-raised">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Create</h3>
          <p className="text-sm text-muted-foreground">Off until you turn it on. New items only.</p>
        </div>
        <ul className="flex flex-col divide-y">
          {WRITABLE.map((app) => (
            <li key={app.slug} className="flex h-10 items-center gap-2.5 text-sm">
              <AppMark slug={app.slug} className="size-4" />
              <span className="text-foreground">{app.name}</span>
              <span className="ml-auto text-muted-foreground">{app.write.creates}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The services under the product: models, web search, and app access. */
export function StackLine() {
  const items = [
    { label: "Free models through", brands: [["openrouter", "OpenRouter"]] },
    {
      label: "Web search through",
      brands: [
        ["linkup", "Linkup"],
        ["exa", "Exa"],
        ["tavily", "Tavily"],
      ],
    },
    { label: "Apps through", brands: [["composio", "Composio"]] },
  ] as const;
  return (
    <ul className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-8">
      {items.map((item) => (
        <li key={item.label} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.label}
          {item.brands.map(([brand, name]) => (
            <span key={brand} className="inline-flex items-center gap-1.5 text-foreground">
              <BrandMark brand={brand} />
              {name}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
