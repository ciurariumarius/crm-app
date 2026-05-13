"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type NotesSearchInputProps = {
  value: string
  onChange: (value: string) => void
  showShortcutHint?: boolean
  variant?: "default" | "apple"
  density?: "compact" | "comfortable"
}

export const NotesSearchInput = React.forwardRef<HTMLInputElement, NotesSearchInputProps>(
  function NotesSearchInput(
    { value, onChange, showShortcutHint = true, variant = "default", density = "comfortable" },
    ref
  ) {
    const hasValue = value.trim().length > 0
    const isApple = variant === "apple"
    const inputHeight = density === "compact" ? "h-9" : "h-10"

    return (
      <div className={cn("relative w-full md:mx-auto md:max-w-[600px]", inputHeight)}>
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <Search className="h-4 w-4" />
        </div>
        <Input
          ref={ref}
          placeholder="Search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && hasValue) {
              event.preventDefault()
              onChange("")
            }
          }}
          className={cn(
            "w-full pl-11 pr-16 text-[14px] font-medium outline-none transition placeholder:font-medium placeholder:text-[var(--text-muted)] focus-visible:ring-offset-0",
            inputHeight,
            isApple
              ? "rounded-[14px] border border-[#dde3eb] bg-[color:color-mix(in_srgb,#f6f7f9_86%,white)] text-[#4b5563] shadow-[inset_0_1px_0_rgba(255,255,255,0.64)] focus-visible:border-[#c7d1de] focus-visible:ring-2 focus-visible:ring-[rgba(148,163,184,0.2)]"
              : "rounded-[28px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)]"
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {showShortcutHint && !hasValue ? (
            <kbd className="hidden h-6 items-center rounded-md border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,transparent)] px-1.5 text-[10px] font-semibold text-[var(--text-muted)] md:inline-flex">
              /
            </kbd>
          ) : null}
          {hasValue ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_28%,transparent)]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    )
  }
)
