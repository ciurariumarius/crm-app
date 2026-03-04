"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

export function TasksSearchInput() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    React.useEffect(() => {
        if (searchParams.get("q") !== searchTerm) {
            setSearchTerm(searchParams.get("q") || "")
        }
    }, [searchParams, searchTerm])

    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""

        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            params.delete("page")
            router.replace(`/tasks?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    return (
        <div className="flex items-center relative transition-all duration-300 ease-in-out bg-card rounded-xl border border-border/60 shadow-sm h-11 w-full focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/50">
            <div className="pl-4 pr-3 text-muted-foreground/50 shrink-0">
                <Search className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <Input
                placeholder="Search tasks, priorities or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-sm font-medium transition-all duration-300 w-full px-0 shadow-none text-foreground"
            />
            {searchTerm && (
                <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="pr-4 pl-2 h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}
