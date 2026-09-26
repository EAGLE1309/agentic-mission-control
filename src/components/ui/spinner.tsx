import { cn } from "cn"
import { IconLoader2 } from "@tabler/icons-react"

// Design §5.3: IconLoader2, one turn each 800ms, linear. Still with reduced motion.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <IconLoader2
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-[spin_0.8s_linear_infinite] motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
      {...props}
    />
  )
}

export { Spinner }
