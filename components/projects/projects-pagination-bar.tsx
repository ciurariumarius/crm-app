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
        const params = new URLSearchParams(searchParams.toString())
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
        <div className="rounded-[18px] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] px-2.5 py-2 shadow-[0_4px_14px_rgba(15,23,42,0.03)] sm:px-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                aria-label="Projects per page"
                                title="Projects per page"
                            >
                                {display.perPage}
                                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-20 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                            {pageSizeOptions.map((size) => (
                                <DropdownMenuItem key={size} asChild className="cursor-pointer justify-center rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700">
                                    <Link href={buildHref({ perPage: String(size), page: "1" })}>
                                        {size}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700">
                        {isSearching ? "..." : `${display.page}/${display.totalPages}`}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {display.prevPage ? (
                        <Link
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                            href={buildHref({ page: String(display.prevPage) })}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    ) : (
                        <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100/70 text-slate-400"
                            aria-hidden="true"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </span>
                    )}
                    {display.nextPage ? (
                        <Link
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                            href={buildHref({ page: String(display.nextPage) })}
                            aria-label="Next page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    ) : (
                        <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100/70 text-slate-400"
                            aria-hidden="true"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
