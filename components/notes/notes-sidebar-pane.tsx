import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function NotesSidebarPane({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <aside
      aria-label="Notes folders and collections"
      className={cn("min-h-0 overflow-hidden bg-[var(--surface-low)]", className)}
    >
      {children}
    </aside>
  )
}
