import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function NotesListPane({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label="Notes list"
      className={cn("min-h-0 overflow-hidden bg-[var(--surface-lowest)]", className)}
    >
      {children}
    </section>
  )
}
