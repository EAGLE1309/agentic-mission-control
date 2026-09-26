"use client";

import { useEffect, useRef, useState } from "react";
import { statusSpec, missionStatusKind } from "@/components/status";
import { useMissionStatus } from "./mission-meta";
import { useRun } from "./store";

/**
 * A polite live region (design §8). It announces only mission status changes
 * and "Report ready". Thoughts and tool calls would flood a screen reader.
 */
export function RunAnnouncer({ extra }: { extra?: string | null }) {
  const { status, partial } = useMissionStatus();
  const versions = useRun((state) => state.view.versions.length);
  const loaded = useRun((state) => state.loaded);
  const [message, setMessage] = useState("");
  const previous = useRef<{ status: string; versions: number } | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const last = previous.current;
    previous.current = { status: `${status}:${partial}`, versions };
    if (!last) return;
    let next = "";
    if (versions > last.versions) next = versions === 1 ? "Report ready." : `Report version ${versions} ready.`;
    else if (`${status}:${partial}` !== last.status) next = `Mission ${statusSpec(missionStatusKind(status, partial)).label.toLowerCase()}.`;
    if (!next) return;
    const timer = setTimeout(() => setMessage(next), 0);
    return () => clearTimeout(timer);
  }, [loaded, status, partial, versions]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {extra || message}
    </div>
  );
}
