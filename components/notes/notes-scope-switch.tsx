"use client"

import { cn } from "@/lib/utils"
import type { NotesWorkspaceScope } from "@/lib/notes/workspace-state"

export function NotesScopeSwitch({
  value,
  onChange,
}: {
  value: NotesWorkspaceScope
  onChange: (scope: NotesWorkspaceScope) => void
}) {
  return (
    <div
      className="mt-2 grid grid-cols-2 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] p-0.5 text-[11px] font-medium"
      role="group"
      aria-label="Notes list scope"
    >
      {(["view", "all"] as const).map((scope) => {
        const selected = value === scope
        return (
          <button
            key={scope}
            type="button"
            aria-pressed={selected}
            className={cn(
              "rounded-md px-2 py-1.5 transition-colors",
              selected
                ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            onClick={() => onChange(scope)}
          >
            {scope === "view" ? "Current View" : "All Notes"}
          </button>
        )
      })}
    </div>
  )
}
