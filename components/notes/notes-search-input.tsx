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
    { value, onChange, showShortcutHint = false, density = "comfortable" },
    ref
  ) {
    const hasValue = value.trim().length > 0
    const inputHeight = density === "compact" ? "h-8.5" : "h-9"

    return (
      <div className={cn("relative w-full", inputHeight)}>
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <Search className="h-4 w-4" />
        </div>
        <Input
          ref={ref}
          type="text"
          aria-label="Search notes"
          placeholder="Search notes..."
          value={value}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && hasValue) {
              event.preventDefault()
              onChange("")
            }
          }}
          className={cn(
            "w-full rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] pl-9 text-xs font-normal text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus-visible:border-[var(--primary)] focus-visible:bg-[var(--surface-lowest)] focus-visible:ring-0 shadow-none",
            hasValue ? "pr-8" : showShortcutHint ? "pr-12" : "pr-3",
            inputHeight
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {showShortcutHint && !hasValue ? (
            <kbd className="hidden h-5 items-center rounded border border-[var(--line-subtle)] bg-[var(--surface-low)] px-1.5 text-xs font-medium text-[var(--text-muted)] md:inline-flex">
              ⌘K
            </kbd>
          ) : null}
          {hasValue ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:outline-none"
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
