"use client";

import type { ComponentProps } from "react";
import { Streamdown, type Components } from "streamdown";
import { cn } from "@/lib/utils";

// The report body (design §6.3 markdown styles, Prose role). Raw HTML is off,
// and links open in a new tab with rel="noopener noreferrer nofollow"
// (tech spec §10).

const components: Components = {
  h1: ({ className, ...props }) => <h1 className={cn("mt-8 mb-3 text-xl font-semibold text-balance first:mt-0", className)} {...props} />,
  h2: ({ className, ...props }) => <h2 className={cn("mt-8 mb-3 text-lg font-semibold text-balance", className)} {...props} />,
  h3: ({ className, ...props }) => <h3 className={cn("mt-6 mb-2 text-base font-semibold text-balance", className)} {...props} />,
  h4: ({ className, ...props }) => <h4 className={cn("mt-6 mb-2 text-base font-semibold", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("my-[26px] text-pretty first:mt-0", className)} {...props} />,
  a: ({ className, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn("text-link underline underline-offset-2", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => <ul className={cn("my-4 list-disc pl-6 marker:text-muted-foreground", className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn("my-4 list-decimal pl-6 marker:text-muted-foreground", className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn("my-1 pl-1", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn("my-4 border-l-2 pl-4 text-muted-foreground", className)} {...props} />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-8 border-border", className)} {...props} />,
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table className={cn("w-full text-sm tabular-nums", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th className={cn("border-b px-3 py-2 text-left font-medium text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => <td className={cn("border-b px-3 py-2 align-top", className)} {...props} />,
  inlineCode: ({ className, ...props }) => (
    <code className={cn("rounded-sm bg-muted px-1 font-mono text-[0.875em]", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre className={cn("my-6 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs", className)} {...props} />
  ),
};

export function Markdown({ children, className, ...props }: { children: string } & Omit<ComponentProps<"div">, "children">) {
  return (
    <div className={cn("text-base leading-relaxed text-foreground", className)} {...props}>
      <Streamdown
        mode="static"
        skipHtml
        controls={false}
        linkSafety={{ enabled: false }}
        components={components}
      >
        {children}
      </Streamdown>
    </div>
  );
}
