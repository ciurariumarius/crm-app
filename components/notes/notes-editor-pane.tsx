import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function NotesEditorPane({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label="Note editor"
      className={cn("min-h-0 min-w-0 overflow-hidden bg-[var(--surface-lowest)]", className)}
    >
      {children}
    </section>
  )
}
