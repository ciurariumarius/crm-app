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
import { Search, Users, Briefcase, ChevronDown, Filter, X } from "lucide-react"
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
    const [isSearchExpanded, setIsSearchExpanded] = React.useState(!!searchParams.get("q"))
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

    const FilterContent = () => (
        <>
            {/* Partner & Project Pills */}
            <div className="flex xl:items-center flex-col xl:flex-row gap-4 xl:gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">

                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Partner</div>
                    {/* Partner Dropdown */}
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
                                    {p.name.toUpperCase()}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="h-px w-full bg-border/40 my-4 xl:hidden" />
                <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />

                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Project</div>
                    {/* Project Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={cn(
                                "px-4 py-3 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 flex items-center justify-between xl:justify-center gap-2 w-full xl:w-auto bg-muted/30 xl:bg-transparent",
                                currentProject !== "all"
                                    ? "xl:bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                                    : "text-muted-foreground hover:text-foreground"
                            )}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Briefcase className="w-4 h-4 xl:w-3 xl:h-3 shrink-0" />
                                    <span className="truncate max-w-[200px] xl:max-w-[150px]">
                                        {projects.find(p => p.id === currentProject)?.displayName || "ALL PROJECTS"}
                                    </span>
                                </div>
                                <ChevronDown className="w-4 h-4 xl:w-3 xl:h-3 opacity-50 shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[320px] xl:w-[300px] max-h-[350px] overflow-y-auto bg-popover/95 backdrop-blur-sm z-50 p-1">
                            <DropdownMenuItem onSelect={() => updateFilter("projectId", "all")} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                ALL PROJECTS
                            </DropdownMenuItem>
                            {filteredProjects.map((p) => (
                                <DropdownMenuItem key={p.id} onSelect={() => updateFilter("projectId", p.id)} className="text-xs xl:text-[10px] font-bold uppercase tracking-wider py-3 xl:py-2 cursor-pointer">
                                    {p.displayName.toUpperCase()}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="pb-8 xl:hidden" />
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
                        placeholder="Search logs..."
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
