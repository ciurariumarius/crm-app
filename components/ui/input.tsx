import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[var(--text-muted)] selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 rounded-xl border border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-1 text-[13px] shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-[color,border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-slate-300/80 hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_25%,transparent)]",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-[color:color-mix(in_srgb,var(--destructive)_25%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
