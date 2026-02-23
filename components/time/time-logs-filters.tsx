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

interface TimeLogsFiltersProps {
    partners: { id: string; name: string }[]
    projects: { id: string; displayName: string; site: { partnerId: string } }[]
}

export function TimeLogsFilters({ partners, projects }: TimeLogsFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Local state for search
    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    // Sync from URL
    React.useEffect(() => {
        if (searchParams.get("q") !== searchTerm) {
            setSearchTerm(searchParams.get("q") || "")
        }
    }, [searchParams])

    // Update URL on search
    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""

        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            router.replace(`/time?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    const handleSearch = (term: string) => {
        setSearchTerm(term)
    }

    const updateFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (!value || value === "all") {
            params.delete(key)
        } else {
            params.set(key, value)
            // If setting partner, clear project as they might be incompatible
            if (key === "partnerId") params.delete("projectId")
            // If setting project, clear partner as project implies partner
            if (key === "projectId") params.delete("partnerId")
        }
        router.push(`/time?${params.toString()}`)
    }

    const currentPartner = searchParams.get("partnerId") || "all"
    const currentProject = searchParams.get("projectId") || "all"

    // Filter projects for dropdown if partner is selected
    const filteredProjects = currentPartner !== "all"
        ? projects.filter(p => p.site.partnerId === currentPartner)
        : projects

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-card rounded-[24px] xl:rounded-full p-2 shadow-sm border border-border/60 sticky top-4 z-40 backdrop-blur-xl bg-card/80">

            {/* Left: Search (Fixed Compact) */}
            <div className="relative w-full xl:w-[200px] pl-4 pr-4 xl:pr-0">
                <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-9 h-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-xs"
                />
            </div>

            {/* Middle: Filters (Pills) */}
            <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto scrollbar-hide px-2">

                {/* Partner & Project Pills */}
                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">

                    {/* Partner Dropdown */}
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
                                    {p.name.toUpperCase()}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                    {/* Project Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-2",
                                currentProject !== "all"
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <Briefcase className="w-3 h-3" />
                                <span className="max-w-[150px] truncate">
                                    {projects.find(p => p.id === currentProject)?.displayName || "ALL PROJECTS"}
                                </span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[300px] max-h-[350px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50 p-1">
                            <DropdownMenuItem onSelect={() => updateFilter("projectId", "all")} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                                ALL PROJECTS
                            </DropdownMenuItem>
                            {filteredProjects.map((p) => (
                                <DropdownMenuItem key={p.id} onSelect={() => updateFilter("projectId", p.id)} className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer">
                                    {p.displayName.toUpperCase()}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>
            </div>
        </div>
    )
}
