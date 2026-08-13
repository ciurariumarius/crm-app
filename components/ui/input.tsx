import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[var(--text-muted)] selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3.5 py-1 text-[13px] shadow-[var(--shadow-apple)] transition-[color,border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-[color:color-mix(in_srgb,var(--line-subtle)_65%,var(--text-muted))] focus-visible:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_24%,transparent)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-[color:color-mix(in_srgb,var(--destructive)_25%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
