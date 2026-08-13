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
      <div className={cn("relative w-full md:mx-auto md:max-w-[560px]", inputHeight)}>
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
              ? "rounded-[14px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,var(--surface-lowest))] text-[var(--text-primary)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-lowest)_75%,transparent)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_18%,transparent)]"
              : "rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-[var(--shadow-apple)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)]"
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {showShortcutHint && !hasValue ? (
            <kbd className="hidden h-6 items-center rounded-md border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-1.5 text-[10px] font-semibold text-[var(--text-muted)] md:inline-flex">
              /
            </kbd>
          ) : null}
          {hasValue ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none",
                isApple
                  ? "text-[var(--text-muted)] hover:bg-[var(--surface-highest)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_24%,transparent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_28%,transparent)]"
              )}
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
