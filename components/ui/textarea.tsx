import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-[var(--text-muted)] flex field-sizing-content min-h-24 w-full rounded-[12px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3.5 py-3 text-sm shadow-[var(--shadow-apple)] transition-[color,border-color,box-shadow,background-color] outline-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_24%,transparent)] aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-[color:color-mix(in_srgb,var(--destructive)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
