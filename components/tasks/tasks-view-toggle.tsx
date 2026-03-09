"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTransition } from "react"

export function TasksViewToggle({ currentView }: { currentView: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

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
        <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
                onClick={() => setView("list")}
                className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                    currentView === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
            >
                <List className="h-4 w-4" />
            </button>
            <button
                onClick={() => setView("grid")}
                className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                    currentView === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
            >
                <LayoutGrid className="h-4 w-4" />
            </button>

            {currentView === "grid" && (
                <>
                    <div className="w-px h-4 bg-slate-200 mx-1 hidden xl:block" />
                    <div className="hidden xl:flex items-center gap-1">
                        {[2, 3, 4].map((c) => (
                            <button
                                key={c}
                                onClick={() => setCols(c.toString())}
                                className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                                    colsTarget === c.toString() ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
