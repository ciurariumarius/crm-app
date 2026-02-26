"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Search, Users, ChevronDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { DateFilter } from "@/components/projects/date-filter"

interface ProjectsToolbarProps {
    partners: { id: string; name: string }[]
}

export function ProjectsToolbar({ partners }: ProjectsToolbarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Local state for search to avoid lagging input
    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const [isSearchExpanded, setIsSearchExpanded] = React.useState(!!searchParams.get("q"))
    const debouncedSearch = useDebounce(searchTerm, 300)

    // Sync from URL if it changes externally
    React.useEffect(() => {
        if (searchParams.get("q") !== searchTerm) {
            setSearchTerm(searchParams.get("q") || "")
        }
    }, [searchParams])

    // Update URL when debounced value changes
    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""

        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            params.delete("page") // Reset page on new search
            router.replace(`/projects?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    const handleSearch = (term: string) => {
        setSearchTerm(term)
    }

    const updateFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())

        if (key === "payment" && value !== "All" && value !== "all") {
            if (!params.get("status") || params.get("status") === "Active") {
                params.set("status", "All")
            }
        }

        if (value && value !== "All" && value !== "all") {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        // Reset page when filtering
        params.delete("page")
        router.push(`/projects?${params.toString()}`)
    }

    const currentPartner = searchParams.get("partnerId") || "all"

    const handleStatusChange = (val: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (val === "All") {
            params.delete("status") // Default behavior might need explicit "All" if API defaults to "Active"
            // Actually, if we want to show ALL, we might need to send "All" if the backend defaults to "Active" when missing.
            // Based on previous code: if (!params.get("status") || params.get("status") === "Active")
            // It seems "Active" is default. So "All" needs to be sent.
            params.set("status", "All")
        } else {
            params.set("status", val)
        }
        params.delete("page")
        router.push(`/projects?${params.toString()}`)
    }

    const currentParams = {
        partner: searchParams.get("partnerId") || "all",
        status: searchParams.get("status") || "Active",
        type: searchParams.get("recurring") || "All",
        payment: searchParams.get("payment") || "All"
    }

    const getButtonStyle = (value: string, isActive: boolean) => {
        if (isActive) {
            if (value === 'Paid') return "bg-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-0 font-bold"
            if (value === 'Unpaid') return "bg-rose-600 text-white shadow-md shadow-rose-500/20 ring-0 font-bold"
            if (value === 'Active') return "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-0 font-bold"
            if (value === 'Paused') return "bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-0 font-bold"
            if (value === 'Completed') return "bg-blue-500 text-white shadow-md shadow-blue-500/20 ring-0 font-bold"
            return "bg-background text-foreground shadow-md ring-0 font-bold"
        }
        return "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }

    const getSegmentBtnClass = (isActive: boolean) => cn(
        "px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 rounded-[10px]",
        isActive
            ? "bg-white dark:bg-zinc-800 text-foreground shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-border/20"
            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
    )

    return (
        <div className="flex flex-row items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 w-full hidescrollbar snap-x mt-4">
            {/* Inline Desktop/Mobile Search Pill */}
            <div className="flex items-center bg-white dark:bg-zinc-900 border border-border/60 shadow-sm rounded-xl h-10 px-4 shrink-0 focus-within:ring-1 focus-within:ring-blue-500 w-[240px] snap-start transition-colors">
                <Search className="w-4 h-4 text-muted-foreground/40 shrink-0 mr-3" />
                <Input
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="h-full bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-[10px] font-bold tracking-widest uppercase transition-all duration-300 w-full px-0 text-foreground shadow-none"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="shrink-0 ml-1">
                        <X className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </button>
                )}
            </div>

            {/* Status Segmented Control */}
            <div className="flex bg-muted/40 dark:bg-zinc-900/50 p-1 rounded-xl border border-border/50 shrink-0 snap-start items-center">
                {[
                    { label: "ALL", value: "All" },
                    { label: "ACTIVE", value: "Active", icon: <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" /> },
                    { label: "PAUSED", value: "Paused", icon: null },
                    { label: "COMPLETED", value: "Completed", icon: null }
                ].map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={cn(getSegmentBtnClass(currentParams.status === opt.value), "flex items-center")}
                    >
                        {opt.value === "Active" && currentParams.status === "Active" && opt.icon}
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Partner Dropdown */}
            <DropdownMenu>
                <div className="shrink-0 snap-start">
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 h-10 px-4 bg-white dark:bg-zinc-900 border border-border/60 shadow-sm rounded-xl transition-colors hover:bg-muted/50 text-[10px] font-bold tracking-widest uppercase">
                            <Users className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                            <span className={cn(currentPartner !== "all" ? "text-foreground" : "text-muted-foreground")}>
                                {currentPartner !== "all" ? partners.find(p => p.id === currentPartner)?.name || "PARTNER" : "PARTNER"}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent align="start" className="w-[200px]">
                    <DropdownMenuItem onSelect={() => updateFilter("partnerId", "all")} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                        All Partners
                    </DropdownMenuItem>
                    {partners.map((p) => (
                        <DropdownMenuItem key={p.id} onSelect={() => updateFilter("partnerId", p.id)} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                            {p.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Timeline Filter component wrapper */}
            <div className="shrink-0 snap-start">
                <DateFilter />
            </div>

            {/* Type Segmented Control */}
            <div className="flex bg-muted/40 dark:bg-zinc-900/50 p-1 rounded-xl border border-border/50 shrink-0 snap-start items-center">
                <div className="text-[10px] font-bold text-blue-600/50 uppercase px-3 hidden md:flex"><span className="w-2.5 h-2.5 rounded-full border border-blue-500/50 flex items-center justify-center mr-1 text-[6px]">↻</span></div>
                {[
                    { label: "ALL", value: "All" },
                    { label: "MONTHLY", value: "Recurring" },
                    { label: "ONE-TIME", value: "OneTime" }
                ].map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => updateFilter("recurring", opt.value)}
                        className={getSegmentBtnClass(currentParams.type === opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Payment Segmented Control */}
            <div className="flex bg-muted/40 dark:bg-zinc-900/50 p-1 rounded-xl border border-border/50 shrink-0 snap-start items-center">
                <div className="text-[10px] font-bold text-emerald-600/50 uppercase px-3 hidden md:flex"><span className="w-2.5 h-2.5 rounded-full border border-emerald-500/50 bg-emerald-50 mr-1" /></div>
                {[
                    { label: "ALL", value: "All" },
                    { label: "PAID", value: "Paid" },
                    { label: "UNPAID", value: "Unpaid" }
                ].map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => updateFilter("payment", opt.value)}
                        className={getSegmentBtnClass(currentParams.payment === opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
