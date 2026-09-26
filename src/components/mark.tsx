import { cn } from "@/lib/utils";

/** The product mark: one plan node that splits into two tasks. It uses currentColor. */
export function Mark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      <path d="M6.5 10 13 5.5M6.5 10l6.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="10" r="2.75" fill="currentColor" />
      <circle cx="15" cy="5" r="2.25" fill="currentColor" />
      <circle cx="15" cy="15" r="2.25" fill="currentColor" />
    </svg>
  );
}
