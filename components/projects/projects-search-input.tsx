"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

export function ProjectsSearchInput() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    React.useEffect(() => {
        const urlQ = searchParams.get("q") || ""
        if (urlQ !== searchTerm) {
            setSearchTerm(urlQ)
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
            router.replace(`/projects?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    return (
        <div className="relative h-11 w-full">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-4 w-4" />
            </div>
            <Input
                placeholder="Search projects, clients or campaigns..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:ring-offset-0 focus-visible:border-blue-300 placeholder:text-slate-400 text-slate-900"
            />
            {searchTerm && (
                <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

