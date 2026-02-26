"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTransition } from "react"

export function TasksViewToggle({ currentView }: { currentView: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

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

    return (
        <div className="flex items-center p-1 bg-white dark:bg-zinc-900 rounded-xl gap-1 border border-border/60 shadow-sm">
            <button
                onClick={() => setView("list")}
                className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    currentView === "list" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "text-muted-foreground/50 hover:text-foreground"
                )}
            >
                <List className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
                onClick={() => setView("grid")}
                className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    currentView === "grid" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "text-muted-foreground/50 hover:text-foreground"
                )}
            >
                <LayoutGrid className="h-4 w-4" strokeWidth={2.5} />
            </button>
        </div>
    )
}
