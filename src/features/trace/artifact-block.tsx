"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconCircleX } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * A Mono block of tool input or output (design §6.5): the preview first, and
 * the full text on demand. The artifact loads only when the user asks.
 */
export function TextBlock({
  label,
  preview,
  artifactId,
  tone = "default",
}: {
  label: string;
  preview: string;
  artifactId: Id<"artifacts"> | null;
  tone?: "default" | "destructive";
}) {
  const [requested, setRequested] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <FullTextCopy preview={preview} artifactId={requested ? artifactId : null} label={`Copy ${label.toLowerCase()}`} />
      </div>
      {requested && artifactId ? (
        <ArtifactBoundary fallback={<BlockText text={preview} tone={tone} />}>
          <FullText artifactId={artifactId} preview={preview} tone={tone} />
        </ArtifactBoundary>
      ) : (
        <BlockText text={preview} tone={tone} />
      )}
      {artifactId && !requested && (
        <Button variant="outline" size="xs" className="self-start" onClick={() => setRequested(true)}>
          Show full output
        </Button>
      )}
    </div>
  );
}

function BlockText({ text, tone }: { text: string; tone: "default" | "destructive" }) {
  return (
    <pre
      className={
        tone === "destructive"
          ? "max-h-60 overflow-auto rounded-md bg-destructive-subtle p-3 font-mono text-xs break-words whitespace-pre-wrap text-destructive"
          : "max-h-60 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap text-foreground"
      }
    >
      {text || "(empty)"}
    </pre>
  );
}

function FullText({ artifactId, preview, tone }: { artifactId: Id<"artifacts">; preview: string; tone: "default" | "destructive" }) {
  const artifact = useQuery(api.artifacts.get, { artifactId });
  const [slow, setSlow] = useState(false);
  // A wait in one place shows a spinner only after 400ms (design §5.8).
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 400);
    return () => clearTimeout(timer);
  }, []);
  if (artifact === undefined) {
    return (
      <div className="relative">
        <BlockText text={preview} tone={tone} />
        {slow && (
          <span className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner className="size-3.5" aria-hidden /> Loading
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <BlockText text={artifact.text} tone={tone} />
      {artifact.truncated && <p className="text-xs text-muted-foreground">The output is cut at 200,000 characters.</p>}
    </>
  );
}

function FullTextCopy({ preview, artifactId, label }: { preview: string; artifactId: Id<"artifacts"> | null; label: string }) {
  const artifact = useQuery(api.artifacts.get, artifactId ? { artifactId } : "skip");
  return <CopyButton text={artifact?.text ?? preview} label={label} />;
}

class ArtifactBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <>
        {this.props.fallback}
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <IconCircleX aria-hidden className="size-3.5" />
          The full output did not load.
        </p>
      </>
    );
  }
}
