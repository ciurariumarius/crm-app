"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { useTasksSearchContext } from "./tasks-search-context"
import type { SearchPaginationState } from "@/types/search-pagination"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TasksPaginationBarProps = {
    fallback: SearchPaginationState
    pageSizeOptions: readonly number[]
    defaultPageSize: number
}

export function TasksPaginationBar({
    fallback,
    pageSizeOptions,
    defaultPageSize,
}: TasksPaginationBarProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const searchContext = useTasksSearchContext()
    const hasSearchTerm = Boolean(searchContext?.searchTerm.trim())
    const livePagination = hasSearchTerm ? searchContext?.searchPagination : null
    const display = livePagination ?? fallback

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(overrides)) {
            if (
                value === null ||
                value === "" ||
                (key === "perPage" && Number(value) === defaultPageSize)
            ) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        }
        const query = params.toString()
        return query ? `${pathname}?${query}` : pathname
    }

    return (
        <div className="flex items-center justify-between rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-4 py-3 text-sm shadow-[0_4px_14px_rgba(15,23,42,0.03)]">
            <span className="text-muted-foreground">
                {searchContext?.isSearching && hasSearchTerm
                    ? "Searching..."
                    : `Page ${display.page} of ${display.totalPages} · Showing ${display.pageStart}-${display.pageEnd} of ${display.total} tasks`}
            </span>
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted transition-colors"
                            title="Tasks per page"
                        >
                            {display.perPage}
                            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        {pageSizeOptions.map((size) => (
                            <DropdownMenuItem key={size} asChild className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700">
                                <Link href={buildHref({ perPage: String(size), page: "1" })}>
                                    {size}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {display.prevPage ? (
                    <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildHref({ page: String(display.prevPage) })}>
                        Previous
                    </Link>
                ) : (
                    <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Previous</span>
                )}
                {display.nextPage ? (
                    <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildHref({ page: String(display.nextPage) })}>
                        Next
                    </Link>
                ) : (
                    <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Next</span>
                )}
            </div>
        </div>
    )
}
