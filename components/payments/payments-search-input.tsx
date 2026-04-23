"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"

export function PaymentsSearchInput() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    React.useEffect(() => {
        const urlQ = searchParams.get("q") || ""
        setSearchTerm((current) => (current === urlQ ? current : urlQ))
    }, [searchParams])

    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""

        if (debouncedSearch === currentQ) return

        if (debouncedSearch) {
            params.set("q", debouncedSearch)
        } else {
            params.delete("q")
        }
        params.delete("page")

        const queryString = params.toString()
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    }, [debouncedSearch, pathname, router, searchParams])

    return (
        <div className="relative h-11 w-full md:mx-auto md:max-w-[640px]">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <Search className="h-4 w-4" />
            </div>
            <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-[28px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] pl-11 pr-4 text-[14px] font-medium text-[var(--text-primary)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:font-medium placeholder:text-[var(--text-muted)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_16%,transparent)] focus-visible:ring-offset-0"
            />
        </div>
    )
}
