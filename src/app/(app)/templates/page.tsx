import { IconTemplate } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/features/shell/top-bar";
import { TEMPLATES } from "@/shared/templates";

export const metadata: Metadata = { title: "Templates" };

/** Templates (FR-10, design §6.8). A row opens Home with the composer filled. */
export default function TemplatesPage() {
  return (
    <>
      <TopBar title="Templates" />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <ul className="divide-y">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <Link
                href={`/home?template=${template.id}`}
                className="flex h-12 items-center gap-3 rounded-md px-3 transition-[background-color] duration-150 hover:bg-accent"
              >
                <IconTemplate aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 text-sm text-foreground">{template.title}</span>
                <span className="min-w-0 truncate text-sm text-muted-foreground" title={template.goal}>
                  {template.goal}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
