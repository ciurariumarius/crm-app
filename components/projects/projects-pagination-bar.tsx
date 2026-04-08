"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useProjectsSearchContext } from "./projects-search-context"
import type { SearchPaginationState } from "@/types/search-pagination"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ProjectsPaginationBarProps = {
    fallback: SearchPaginationState
    pageSizeOptions: readonly number[]
    defaultPageSize: number
}

export function ProjectsPaginationBar({
    fallback,
    pageSizeOptions,
    defaultPageSize,
}: ProjectsPaginationBarProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const searchContext = useProjectsSearchContext()
    const hasSearchTerm = Boolean(searchContext?.searchTerm.trim())
    const livePagination = hasSearchTerm ? searchContext?.searchPagination : null
    const display = livePagination ?? fallback
    const isSearching = Boolean(searchContext?.isSearching && hasSearchTerm)

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
        <div className="rounded-[20px] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] px-3.5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:px-4">
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        {isSearching ? "Searching Projects" : "Projects Pagination"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">
                        {isSearching
                            ? "Updating results..."
                            : `Showing ${display.pageStart}-${display.pageEnd} of ${display.total} projects`}
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                    title="Projects per page"
                                >
                                    {display.perPage} / page
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
                        <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600">
                            Page {display.page}/{display.totalPages}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                        {display.prevPage ? (
                            <Link
                                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                href={buildHref({ page: String(display.prevPage) })}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Prev
                            </Link>
                        ) : (
                            <span className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 px-3 text-sm font-semibold text-slate-400">
                                <ChevronLeft className="h-4 w-4" />
                                Prev
                            </span>
                        )}
                        {display.nextPage ? (
                            <Link
                                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                href={buildHref({ page: String(display.nextPage) })}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 px-3 text-sm font-semibold text-slate-400">
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
