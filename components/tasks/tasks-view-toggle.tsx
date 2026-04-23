"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTransition } from "react"

export function TasksViewToggle({ currentView }: { currentView: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [, startTransition] = useTransition()

    const colsTarget = searchParams.get("cols") || "3"

    const setView = (view: "grid" | "list") => {
        const params = new URLSearchParams(searchParams.toString())
        if (view === "grid") {
            params.delete("view")
        } else {
            params.set("view", view)
        }
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    const setCols = (cols: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("cols", cols)
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    return (
        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1 shadow-sm">
            <button
                onClick={() => setView("list")}
                title="List view"
                className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                    currentView === "list" ? "bg-[var(--surface-low)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
            >
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => setView("grid")}
                title="Grid view"
                className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                    currentView !== "list" ? "bg-[var(--surface-low)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
            >
                <LayoutGrid className="h-4 w-4" />
            </button>

            {currentView !== "list" && (
                <>
                    <div className="mx-1 h-4 w-px bg-[var(--line-subtle)]" />
                    {[3, 4].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCols(c.toString())}
                            title={`${c} columns`}
                            className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                                colsTarget === c.toString()
                                    ? "bg-[var(--surface-low)] text-[var(--text-primary)]"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            )}
                        >
                            {c}
                        </button>
                    ))}
                </>
            )}
        </div>
    )
}
