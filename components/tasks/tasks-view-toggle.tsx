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
        <div className="flex items-center p-1 bg-muted/50 rounded-xl gap-1 border border-border/50">
            <button
                onClick={() => setView("list")}
                className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    currentView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => setView("grid")}
                className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    currentView === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <LayoutGrid className="h-4 w-4" />
            </button>
        </div>
    )
}
