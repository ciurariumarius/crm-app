import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[var(--text-muted)] selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 rounded-xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] px-3 py-1 text-[13px] shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-[color,border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_25%,transparent)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-[color:color-mix(in_srgb,var(--destructive)_25%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
