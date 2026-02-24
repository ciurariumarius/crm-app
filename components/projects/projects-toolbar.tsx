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
import { Search, Users, ChevronDown } from "lucide-react"
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

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-card rounded-[24px] xl:rounded-full p-2 shadow-sm border border-border/60 z-40 backdrop-blur-xl bg-card/80">

            {/* Left: Search (Fixed Compact) */}
            <div className="relative w-full xl:w-[200px] pl-4 pr-4 xl:pr-0">
                <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-9 h-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-xs"
                />
            </div>

            {/* Middle: Filters (Pills) */}
            <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto scrollbar-hide px-2">

                {/* Status Pills */}
                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">
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
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                getButtonStyle(opt.value, currentParams.status === opt.value)
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                {/* Payment Pills */}
                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">
                    {[
                        { label: "ALL", value: "All" },
                        { label: "PAID", value: "Paid" },
                        { label: "UNPAID", value: "Unpaid" }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => updateFilter("payment", opt.value)}
                            className={cn(
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                getButtonStyle(opt.value, currentParams.payment === opt.value)
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                {/* Type & Partner Pills */}
                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">

                    {/* Type Dropdown as Pill */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-2",
                                currentParams.type !== "All"
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <span>{currentParams.type === "Recurring" ? "MONTHLY" : currentParams.type === "OneTime" ? "ONE-TIME" : "ALL TYPES"}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[140px] bg-popover/95 backdrop-blur-sm z-50 p-1">
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "All")} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                                All Types
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "Recurring")} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                                Monthly
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => updateFilter("recurring", "OneTime")} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                                One-Time
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Partner Dropdown as Pill */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-2",
                                currentPartner !== "all"
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <Users className="w-3 h-3" />
                                <span className="max-w-[100px] truncate">
                                    {partners.find(p => p.id === currentPartner)?.name || "ALL PARTNERS"}
                                </span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50 p-1">
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
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />
                <DateFilter />

            </div>
        </div>
    )
}
