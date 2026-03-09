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
import { Search, Users, ChevronDown, Filter, X, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"

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

    const activeFilterCount =
        (currentParams.partner !== "all" ? 1 : 0) +
        (currentParams.type !== "All" ? 1 : 0) +
        (currentParams.payment !== "All" ? 1 : 0) +
        (searchParams.get("period") && searchParams.get("period") !== "all_time" ? 1 : 0);

    const hasFilters = activeFilterCount > 0;

    const clearAllFilters = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("partnerId")
        params.delete("recurring")
        params.delete("payment")
        params.delete("period")
        params.delete("page")
        router.push(`/projects?${params.toString()}`)
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
        "segmented-pill",
        isActive ? "segmented-pill-active" : "hover:bg-white/70"
    )

    const getFilterBtnClass = (isActive: boolean) => cn(
        "px-4 py-2 text-xs font-medium transition-all duration-200 rounded-lg border",
        isActive
            ? "bg-white text-slate-900 border-slate-200 shadow-sm"
            : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white"
    )

    return (
        <div className="flex flex-col gap-4 mt-4 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Inline Desktop/Mobile Search Pill */}
                    <div className="flex items-center bg-slate-100 border border-transparent rounded-xl h-9 px-3 shrink-0 focus-within:bg-white focus-within:border-slate-200 focus-within:shadow-sm w-full sm:w-[280px] transition-all">
                        <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                        <Input
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="h-full bg-transparent border-none focus-visible:ring-0 placeholder:text-slate-400 text-[13px] font-medium transition-all duration-300 w-full px-0 text-slate-900 shadow-none"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm("")} className="shrink-0 ml-1">
                                <X className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hidescrollbar pb-1 sm:pb-0 -mb-1 sm:mb-0 max-w-full">
                    {/* Mobile Status Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex md:hidden items-center gap-2 h-9 px-4 bg-slate-100 border border-slate-200 rounded-xl transition-colors hover:bg-white text-xs font-medium shrink-0">
                                {currentParams.status === "Active" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                                <span className="text-foreground whitespace-nowrap">
                                    {currentParams.status === "All" ? "Status: All" : currentParams.status}
                                </span>
                                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[150px]">
                            {[
                                { label: "ALL", value: "All" },
                                { label: "ACTIVE", value: "Active", icon: <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 shrink-0 inline-block" /> },
                                { label: "PAUSED", value: "Paused", icon: null },
                                { label: "COMPLETED", value: "Completed", icon: null }
                            ].map((opt) => (
                                <DropdownMenuItem
                                    key={opt.value}
                                    onSelect={() => handleStatusChange(opt.value)}
                                    className="text-xs font-medium py-2 cursor-pointer flex items-center"
                                >
                                    {opt.icon}
                                    {opt.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Desktop Status Segmented Control */}
                    <div className="hidden md:flex segmented-track shrink-0 items-center">
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

                    {/* Desktop Selected Filters Inline */}
                    <div className="hidden lg:flex items-center gap-2 shrink-0">
                        {/* Partner Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 h-9 px-3.5 bg-slate-100 border border-slate-200 rounded-xl transition-colors hover:bg-white text-xs font-medium">
                                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className={cn(currentParams.partner !== "all" ? "text-slate-900 font-semibold" : "text-slate-600")}>
                                        {currentParams.partner !== "all" ? partners.find(p => p.id === currentParams.partner)?.name || "Partner" : "Partner"}
                                    </span>
                                    <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[200px] rounded-xl border border-border/60 shadow-md">
                                <DropdownMenuItem onSelect={() => updateFilter("partnerId", "all")} className="text-xs font-medium py-2 cursor-pointer">
                                    All Partners
                                </DropdownMenuItem>
                                {partners.map((p) => (
                                    <DropdownMenuItem key={p.id} onSelect={() => updateFilter("partnerId", p.id)} className="text-xs font-medium py-2 cursor-pointer">
                                        {p.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Timeline Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 h-9 px-3.5 bg-slate-100 border border-slate-200 rounded-xl transition-colors hover:bg-white text-xs font-medium">
                                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                                    <span className={cn(searchParams.get("period") && searchParams.get("period") !== "all_time" ? "text-slate-900 font-semibold" : "text-slate-600")}>
                                        {searchParams.get("period") && searchParams.get("period") !== "all_time"
                                            ? [
                                                { label: "All Time", value: "all_time" },
                                                { label: "This Month", value: "this_month" },
                                                { label: "Last Month", value: "last_month" },
                                                { label: "This Year", value: "this_year" },
                                                { label: "Last Year", value: "last_year" },
                                            ].find(p => p.value === searchParams.get("period"))?.label || "Timeline"
                                            : "Timeline"}
                                    </span>
                                    <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[150px] rounded-xl border border-border/60 shadow-md">
                                {[
                                    { label: "All Time", value: "all_time" },
                                    { label: "This Month", value: "this_month" },
                                    { label: "Last Month", value: "last_month" },
                                    { label: "This Year", value: "this_year" },
                                    { label: "Last Year", value: "last_year" },
                                ].map((p) => (
                                    <DropdownMenuItem
                                        key={p.value}
                                        onSelect={() => {
                                            const params = new URLSearchParams(searchParams.toString())
                                            if (p.value !== "all_time") {
                                                params.set("period", p.value)
                                            } else {
                                                params.delete("period")
                                            }
                                            params.delete("page")
                                            router.push(`/projects?${params.toString()}`)
                                        }}
                                        className="text-xs font-medium py-2 cursor-pointer"
                                    >
                                        {p.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Type Segmented Control */}
                        <div className="segmented-track shrink-0 items-center">
                            <div className="text-xs font-semibold text-blue-600/70 px-3 flex"><span className="w-2.5 h-2.5 rounded-full border border-blue-500/50 flex items-center justify-center mr-1 text-[6px]">↻</span></div>
                            {[
                                { label: "All", value: "All" },
                                { label: "Monthly", value: "Recurring" },
                                { label: "One-Time", value: "OneTime" }
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
                        <div className="segmented-track shrink-0 items-center">
                            <div className="text-xs font-semibold text-emerald-600/70 px-3 flex"><span className="w-2.5 h-2.5 rounded-full border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950 mr-1" /></div>
                            {[
                                { label: "All", value: "All" },
                                { label: "Paid", value: "Paid" },
                                { label: "Unpaid", value: "Unpaid" }
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

                    {/* Filter Sheet Trigger */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="flex lg:hidden items-center gap-2 h-9 px-4 bg-slate-100 border border-slate-200 rounded-xl transition-colors hover:bg-white text-xs font-medium uppercase relative shrink-0">
                                <Filter className="w-4 h-4 text-muted-foreground/60" />
                                <span>Filters</span>
                                {hasFilters && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white shadow-sm">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                        </SheetTrigger>
                        <SheetContent className="overflow-y-auto w-full sm:max-w-md bg-white/90 p-6 z-[100]">
                            <SheetHeader className="mb-6 mt-4">
                                <div className="flex items-center justify-between">
                                    <SheetTitle className="text-xl font-bold tracking-tight">Filters</SheetTitle>
                                    {hasFilters && (
                                        <button
                                            onClick={clearAllFilters}
                                            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>
                            </SheetHeader>

                            <div className="flex flex-col gap-8">
                                {/* Partner Filter */}
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Partner
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => updateFilter("partnerId", "all")}
                                            className={getFilterBtnClass(currentParams.partner === "all")}
                                        >
                                            All Partners
                                        </button>
                                        {partners.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => updateFilter("partnerId", p.id)}
                                                className={getFilterBtnClass(currentParams.partner === p.id)}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Timeline Filter */}
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Timeline
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: "All Time", value: "all_time" },
                                            { label: "This Month", value: "this_month" },
                                            { label: "Last Month", value: "last_month" },
                                            { label: "This Year", value: "this_year" },
                                            { label: "Last Year", value: "last_year" },
                                        ].map((p) => (
                                            <button
                                                key={p.value}
                                                onClick={() => {
                                                    const params = new URLSearchParams(searchParams.toString())
                                                    if (p.value !== "all_time") {
                                                        params.set("period", p.value)
                                                    } else {
                                                        params.delete("period")
                                                    }
                                                    params.delete("page")
                                                    router.push(`/projects?${params.toString()}`)
                                                }}
                                                className={getFilterBtnClass((searchParams.get("period") || "all_time") === p.value)}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Type Filter */}
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <span className="w-3.5 h-3.5 rounded-full border border-blue-500/50 flex items-center justify-center text-[8px] text-blue-500">↻</span>
                                        Project Type
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: "ALL", value: "All" },
                                            { label: "MONTHLY", value: "Recurring" },
                                            { label: "ONE-TIME", value: "OneTime" }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateFilter("recurring", opt.value)}
                                                className={getFilterBtnClass(currentParams.type === opt.value)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment Filter */}
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <span className="w-3.5 h-3.5 rounded-full border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950" />
                                        Payment Status
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: "ALL", value: "All" },
                                            { label: "PAID", value: "Paid" },
                                            { label: "UNPAID", value: "Unpaid" }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateFilter("payment", opt.value)}
                                                className={getFilterBtnClass(currentParams.payment === opt.value)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    )
}
