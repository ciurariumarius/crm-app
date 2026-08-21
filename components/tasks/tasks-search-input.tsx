"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useTasksSearchContext } from "./tasks-search-context"
import { cn } from "@/lib/utils"
export function TasksSearchInput() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const searchContext = useTasksSearchContext()

    const [urlSearchTerm, setUrlSearchTerm] = React.useState(searchParams.get("q") || "")
    const searchTerm = searchContext ? searchContext.searchTerm : urlSearchTerm
    const setSearchTerm = searchContext ? searchContext.setSearchTerm : setUrlSearchTerm
    const debouncedSearch = useDebounce(searchTerm, 300)

    React.useEffect(() => {
        if (searchContext) return
        const urlQ = searchParams.get("q") || ""
        setUrlSearchTerm((current) => (current === urlQ ? current : urlQ))
    }, [searchContext, searchParams])

    React.useEffect(() => {
        if (searchContext) {
            if (typeof window === "undefined") return
            const params = new URLSearchParams(window.location.search)
            const currentQ = params.get("q") || ""
            if (debouncedSearch === currentQ) return

            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            params.delete("taskId")
            params.delete("page")

            const queryString = params.toString()
            const nextUrl = queryString ? `${pathname}?${queryString}` : pathname
            const currentUrl = `${pathname}${window.location.search}`

            if (nextUrl !== currentUrl) {
                window.history.replaceState(window.history.state, "", nextUrl)
            }
            return
        }

        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""
        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            params.delete("taskId")
            params.delete("page")
            const queryString = params.toString()
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
        }
    }, [debouncedSearch, pathname, router, searchContext, searchParams])

    const inputRef = React.useRef<HTMLInputElement>(null)

    return (
        <div className={cn(
            "relative h-10 w-full md:max-w-[280px] lg:max-w-[320px] transition-all",
            searchContext?.mobileSearchExpanded ? "flex" : "hidden md:flex"
        )}>
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <Search className="h-4 w-4" />
            </div>
            <Input
                ref={inputRef}
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(event) => {
                    const nextValue = event.target.value
                    if (searchContext && !searchTerm.trim() && nextValue.trim()) {
                        searchContext.setStatusRefined(false)
                    }
                    setSearchTerm(nextValue)
                }}
                className="h-10 w-full rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] pl-9 pr-4 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:font-medium placeholder:text-[var(--text-muted)] focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:ring-offset-0"
            />
        </div>
    )
}
