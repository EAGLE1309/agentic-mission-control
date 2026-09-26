import { Fragment } from "react";

/** CSS variables of the `.blur-in` animation (globals.css). */
export function blurIn(delay: number, options: { y?: number; blur?: number; duration?: number } = {}) {
  return {
    "--blur-in-delay": `${delay}ms`,
    ...(options.y !== undefined && { "--blur-in-y": `${options.y}px` }),
    ...(options.blur !== undefined && { "--blur-in-blur": `${options.blur}px` }),
    ...(options.duration !== undefined && { "--blur-in-duration": `${options.duration}ms` }),
  } as React.CSSProperties;
}

/**
 * Text that blurs in word by word, for the hero headline (design §6.12). The
 * words stay real text with real spaces, so it reads and wraps as one line.
 */
export function BlurInText({
  text,
  delay = 0,
  step = 70,
  className,
}: {
  text: string;
  /** Delay of the first word, in ms. */
  delay?: number;
  /** Delay between words, in ms. */
  step?: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="blur-in inline-block" style={blurIn(delay + index * step)}>
            {word}
          </span>
          {index < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}
