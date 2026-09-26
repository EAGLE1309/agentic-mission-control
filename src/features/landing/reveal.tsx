"use client";

import { useEffect, useRef } from "react";

/**
 * A block that blurs in once, when it first scrolls into view (design §6.12).
 * The server renders it visible, so the content shows without JavaScript. A
 * block that is already on screen at load stays as it is: it never hides.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Delay in ms, to lead with the heading and follow with the rest of a row. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // Start the reveal when the block is 10% into the viewport.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      // A remount must not leave the block hidden.
      if (element.dataset.reveal === "hidden") delete element.dataset.reveal;
    };
  }, []);

  return (
    <div ref={ref} className={className} style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}>
      {children}
    </div>
  );
}
