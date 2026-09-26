import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Chat text with links: markdown links and bare http(s) URLs become anchors.
// Everything else stays plain text, so model text cannot inject markup.

const LINK = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?"'])/g;

function parts(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const url = match[2] ?? match[3];
    const label = match[1] ?? url;
    nodes.push(
      <a key={index} href={url} target="_blank" rel="noreferrer" className="text-link underline-offset-2 [overflow-wrap:anywhere] hover:underline">
        {label}
      </a>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("whitespace-pre-wrap text-pretty [overflow-wrap:anywhere]", className)}>
      {parts(text).map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </p>
  );
}
