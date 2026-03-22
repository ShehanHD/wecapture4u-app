import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // base
        "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-all duration-150",
        // placeholder
        "placeholder:text-muted-foreground/50",
        // focus — soft amber glow
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:shadow-sm",
        // disabled
        "disabled:pointer-events-none disabled:opacity-40 disabled:bg-muted",
        // invalid
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25",
        // file input
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // dark — slightly elevated bg
        "dark:bg-card/80",
        className
      )}
      {...props}
    />
  )
}

export { Input }
