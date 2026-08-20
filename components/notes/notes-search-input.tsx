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
    { value, onChange, showShortcutHint = true, density = "comfortable" },
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
            "w-full rounded-xl border border-[#ECEFEB] bg-white dark:bg-zinc-900 pl-9 pr-12 text-xs font-normal text-zinc-900 dark:text-zinc-100 outline-none transition placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:bg-white dark:focus-visible:bg-zinc-900 focus-visible:ring-0 shadow-none",
            inputHeight
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {showShortcutHint && !hasValue ? (
            <kbd className="hidden h-5 items-center rounded border border-zinc-200/80 bg-zinc-200/50 px-1.5 text-xs font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 md:inline-flex">
              ⌘K
            </kbd>
          ) : null}
          {hasValue ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 focus-visible:outline-none"
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
