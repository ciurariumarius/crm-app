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

    const FilterContent = () => (
        <>
            {/* Status Pills */}
            <div className="flex xl:items-center flex-col xl:flex-row gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Status</div>
                <div className="flex flex-col xl:flex-row gap-1 bg-muted/30 xl:bg-transparent p-1 xl:p-0 rounded-2xl xl:rounded-none">
                    {[
                        { label: "ALL", value: "All" },
                        { label: "ACTIVE", value: "Active" },
                        { label: "PAUSED", value: "Paused" },
                        { label: "COMPLETED", value: "Completed" }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleStatusChange(opt.value)}
                            className={cn(
                                "px-4 py-2 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 whitespace-nowrap text-left xl:text-center w-full xl:w-auto",
                                getButtonStyle(opt.value, currentParams.status === opt.value)
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />
            <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

            {/* Payment Pills */}
            <div className="flex xl:items-center flex-col xl:flex-row gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Payment</div>
                <div className="flex flex-col xl:flex-row gap-1 bg-muted/30 xl:bg-transparent p-1 xl:p-0 rounded-2xl xl:rounded-none">
                    {[
                        { label: "ALL", value: "All" },
                        { label: "PAID", value: "Paid" },
                        { label: "UNPAID", value: "Unpaid" }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => updateFilter("payment", opt.value)}
                            className={cn(
                                "px-4 py-2 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 whitespace-nowrap text-left xl:text-center w-full xl:w-auto",
                                getButtonStyle(opt.value, currentParams.payment === opt.value)
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />
            <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

            {/* Type & Partner Pills */}
            <div className="flex xl:items-center flex-col xl:flex-row gap-4 xl:gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">

                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Type</div>
                    {/* Type Dropdown as Pill */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-3 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 flex items-center justify-between xl:justify-center gap-2 w-full xl:w-auto bg-muted/30 xl:bg-transparent",
                                currentParams.type !== "All"
                                    ? "xl:bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <span>{currentParams.type === "Recurring" ? "MONTHLY" : currentParams.type === "OneTime" ? "ONE-TIME" : "ALL TYPES"}</span>
                                <ChevronDown className="w-4 h-4 xl:w-3 xl:h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] xl:w-[140px] bg-popover/95 backdrop-blur-sm z-50 p-1">
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "All")} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                All Types
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "Recurring")} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                Monthly
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "OneTime")} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                One-Time
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Partner</div>
                    {/* Partner Dropdown as Pill */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-3 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 flex items-center justify-between xl:justify-center gap-2 w-full xl:w-auto bg-muted/30 xl:bg-transparent",
                                currentPartner !== "all"
                                    ? "xl:bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Users className="w-4 h-4 xl:w-3 xl:h-3 shrink-0" />
                                    <span className="truncate max-w-[200px] xl:max-w-[100px]">
                                        {partners.find(p => p.id === currentPartner)?.name || "ALL PARTNERS"}
                                    </span>
                                </div>
                                <ChevronDown className="w-4 h-4 xl:w-3 xl:h-3 opacity-50 shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[280px] xl:w-[200px] max-h-[300px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50 p-1">
                            <DropdownMenuItem onSelect={() => updateFilter("partnerId", "all")} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                All Partners
                            </DropdownMenuItem>
                            {partners.map((p) => (
                                <DropdownMenuItem key={p.id} onSelect={() => updateFilter("partnerId", p.id)} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                    {p.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />
            <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

            <div className="w-full xl:w-auto pb-4 xl:pb-0">
                <DateFilter />
            </div>
        </>
    )

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-card rounded-[24px] xl:rounded-full p-2 shadow-sm border border-border/60 z-40 backdrop-blur-xl bg-card/80">

            <div className="flex items-center justify-between w-full xl:w-auto gap-2">
                {/* Search Toggle */}
                <div className={cn(
                    "flex items-center relative transition-all duration-300 ease-in-out bg-muted/30 rounded-full",
                    isSearchExpanded ? "w-full xl:w-[240px] px-2" : "w-10 xl:w-[200px]"
                )}>
                    <button
                        onClick={() => setIsSearchExpanded(true)}
                        className={cn(
                            "h-10 w-10 flex items-center justify-center rounded-full shrink-0 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50",
                            isSearchExpanded ? "pointer-events-none opacity-50" : "xl:pointer-events-none xl:opacity-100"
                        )}
                    >
                        <Search className="h-4 w-4" />
                    </button>
                    <Input
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        onBlur={() => {
                            if (!searchTerm) setIsSearchExpanded(false)
                        }}
                        className={cn(
                            "h-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-sm xl:text-xs transition-all duration-300 xl:w-full xl:px-0 xl:opacity-100",
                            isSearchExpanded ? "w-full px-2 opacity-100" : "w-0 px-0 opacity-0 xl:opacity-100"
                        )}
                        autoFocus={isSearchExpanded}
                    />
                    {isSearchExpanded && searchTerm && (
                        <button
                            onClick={() => {
                                setSearchTerm("")
                                setIsSearchExpanded(false)
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Mobile Filter Trigger */}
                <div className="xl:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="h-10 px-4 rounded-full bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm font-semibold">
                                <Filter className="h-4 w-4" />
                                Filters
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] rounded-t-[32px] p-0 z-[100]">
                            <div className="flex flex-col h-full bg-background rounded-t-[32px] overflow-hidden">
                                <SheetHeader className="p-6 border-b border-border/50 bg-card/50 backdrop-blur-xl shrink-0">
                                    <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                        <Filter className="h-5 w-5 text-primary" />
                                        Filters
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="p-6 overflow-y-auto w-full max-w-md mx-auto h-full space-y-4">
                                    <FilterContent />
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Desktop Filters (Pills) */}
            <div className="hidden xl:flex items-center gap-2 w-auto px-2">
                <FilterContent />
            </div>
        </div>
    )
}
