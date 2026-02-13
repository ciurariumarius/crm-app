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
import { Search, Users, Briefcase, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"

interface TasksToolbarProps {
    partners: { id: string; name: string }[]
    projects: { id: string; name: string }[]
}

export function TasksToolbar({ partners, projects }: TasksToolbarProps) {
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
            router.replace(`/tasks?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    const handleSearch = (term: string) => {
        setSearchTerm(term)
    }

    const updateFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())

        // Detailed Logic:
        // 1. If value is "All" (case-sensitive from status), we want to set it explicitly
        //    because "Active" is the default when no param exists.
        // 2. If value is "all" (lowercase, from partner/project), we want to DELETE the param (show all).
        // 3. If value is null, delete.
        // 4. Otherwise, set the value.

        if (value === "All") {
            params.set(key, "All")
        } else if (!value || value === "all") {
            params.delete(key)
        } else {
            params.set(key, value)
        }

        router.push(`/tasks?${params.toString()}`)
    }

    const currentPartner = searchParams.get("partnerId") || "all"
    const currentProject = searchParams.get("projectId") || "all"
    const currentStatus = searchParams.get("status") || "Active"

    const getButtonStyle = (value: string, isActive: boolean) => {
        // Active States
        if (isActive) {
            if (value === 'Active') return "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-0 font-bold"
            if (value === 'Paused') return "bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-0 font-bold"
            if (value === 'Completed') return "bg-blue-500 text-white shadow-md shadow-blue-500/20 ring-0 font-bold"
            return "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-md ring-0 font-bold"
        }

        // Inactive 'Hover' States
        if (value === 'Active') return "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
        if (value === 'Paused') return "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
        if (value === 'Completed') return "text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
        return "text-muted-foreground hover:bg-zinc-500/10 hover:text-zinc-900 dark:hover:text-zinc-100"
    }

    const FilterGroup = ({
        options,
        currentValue,
        onChange
    }: {
        options: { label: string, value: string }[],
        currentValue: string,
        onChange: (val: string) => void
    }) => (
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-background border border-border/50 shadow-sm">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "px-4 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-300 ease-out whitespace-nowrap",
                        getButtonStyle(opt.value, currentValue === opt.value)
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )

    const Separator = () => (
        <div className="h-8 w-px bg-border/60 mx-1 hidden 2xl:block" />
    )

    return (
        <div className="flex flex-col 2xl:flex-row gap-4 items-center justify-between bg-card border border-border p-2 rounded-2xl shadow-sm z-30 relative">

            {/* Left Section: Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full 2xl:flex-1">
                {/* Search */}
                <div className="relative flex-1 w-full min-w-[150px] sm:min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-9 h-11 bg-muted/30 border-transparent focus:bg-background focus:border-border transition-all text-sm font-medium rounded-xl"
                    />
                </div>

                {/* Partner Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-full sm:w-[150px] h-11 flex items-center justify-between px-3 border-none bg-muted/30 hover:bg-muted/50 data-[state=open]:bg-muted/50 shadow-none text-[10px] font-bold uppercase tracking-[0.1em] focus:ring-0 rounded-xl outline-none transition-colors">
                        <div className="flex items-center gap-2 truncate">
                            <Users className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="truncate">{partners.find(p => p.id === currentPartner)?.name || "All Partners"}</span>
                        </div>
                        <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50">
                        <DropdownMenuItem onSelect={() => updateFilter("partnerId", "all")} className="text-xs font-bold font-mono py-2 cursor-pointer">
                            ALL PARTNERS
                        </DropdownMenuItem>
                        {partners.map((p) => (
                            <DropdownMenuItem key={p.id} onSelect={() => updateFilter("partnerId", p.id)} className="text-xs font-bold font-mono py-2 cursor-pointer">
                                {p.name.toUpperCase()}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Project Filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="w-full sm:w-[150px] h-11 flex items-center justify-between px-3 border-none bg-muted/30 hover:bg-muted/50 data-[state=open]:bg-muted/50 shadow-none text-[10px] font-bold uppercase tracking-[0.1em] focus:ring-0 rounded-xl outline-none transition-colors">
                        <div className="flex items-center gap-2 truncate">
                            <Briefcase className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="truncate">{projects.find(p => p.id === currentProject)?.name || "All Projects"}</span>
                        </div>
                        <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50">
                        <DropdownMenuItem onSelect={() => updateFilter("projectId", "all")} className="text-xs font-bold font-mono py-2 cursor-pointer">
                            ALL PROJECTS
                        </DropdownMenuItem>
                        {projects.map((p) => (
                            <DropdownMenuItem key={p.id} onSelect={() => updateFilter("projectId", p.id)} className="text-xs font-bold font-mono py-2 cursor-pointer">
                                {p.name.toUpperCase()}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Separator */}
            <Separator />

            {/* Right Section: Status */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full 2xl:w-auto justify-start 2xl:justify-end overflow-x-auto pb-2 2xl:pb-0 scrollbar-hide">
                <FilterGroup
                    options={[
                        { label: "Active", value: "Active" },
                        { label: "Paused", value: "Paused" },
                        { label: "Completed", value: "Completed" },
                        { label: "All", value: "All" }
                    ]}
                    currentValue={currentStatus}
                    onChange={(val) => updateFilter("status", val)}
                />
            </div>
        </div>
    )
}
