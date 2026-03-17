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
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm gap-0.5">
            <button
                onClick={() => setView("list")}
                title="List view"
                className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                    currentView === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700"
                )}
            >
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => setView("grid")}
                title="Grid view"
                className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                    currentView !== "list" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700"
                )}
            >
                <LayoutGrid className="h-4 w-4" />
            </button>

            {currentView !== "list" && (
                <>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    {[3, 4].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCols(c.toString())}
                            title={`${c} columns`}
                            className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                                colsTarget === c.toString()
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-400 hover:text-slate-700"
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
