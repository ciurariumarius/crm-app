"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Search, Briefcase, ChevronDown, Calendar, AlertCircle, ArrowUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Check, ChevronsUpDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TasksToolbarProps {
    partners: { id: string; name: string }[]
    projects: { id: string; name: string }[]
}

export function TasksToolbar({ partners, projects }: TasksToolbarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Local state for search to avoid lagging input
    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const [isSearchFocused, setIsSearchFocused] = React.useState(false)
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
    const currentSort = searchParams.get("sort") || "newest"

    const getButtonStyle = (value: string, isActive: boolean) => {
        // Active States
        if (isActive) {
            if (value === 'Active') return "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-0 font-bold"
            if (value === 'Paused') return "bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-0 font-bold"
            if (value === 'Completed') return "bg-blue-500 text-white shadow-md shadow-blue-500/20 ring-0 font-bold"
            if (value === 'Urgent') return "bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-0 font-bold"
            if (value === 'Idea') return "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 ring-0 font-bold"
            return "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-md ring-0 font-bold"
        }

        // Inactive 'Hover' States
        if (value === 'Active') return "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
        if (value === 'Paused') return "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
        if (value === 'Completed') return "text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
        if (value === 'Urgent') return "text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
        if (value === 'Idea') return "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
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

    const FilterContent = () => (
        <>
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
                            onClick={() => updateFilter("status", opt.value)}
                            className={cn(
                                "px-4 py-2 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 whitespace-nowrap text-left xl:text-center w-full xl:w-auto",
                                (opt.value === "All" && (currentStatus === "All" || !currentStatus) || currentStatus === opt.value)
                                    ? "bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />
            <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

            <div className="flex xl:items-center flex-col xl:flex-row gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Urgency</div>
                <div className="flex flex-col xl:flex-row gap-1 bg-muted/30 xl:bg-transparent p-1 xl:p-0 rounded-2xl xl:rounded-none">
                    {[
                        { label: "ALL", value: "all" },
                        { label: "NORMAL", value: "Normal" },
                        { label: "URGENT", value: "Urgent" },
                        { label: "IDEA", value: "Idea" }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => updateFilter("urgency", opt.value)}
                            className={cn(
                                "px-4 py-2 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 whitespace-nowrap text-left xl:text-center w-full xl:w-auto",
                                (opt.value === "all" && (!searchParams.get("urgency") || searchParams.get("urgency") === "all") || searchParams.get("urgency") === opt.value)
                                    ? "bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-px h-6 bg-border/40 mx-2 hidden xl:block" />
            <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

            {/* Project Filter */}
            <div className="flex xl:items-center flex-col xl:flex-row gap-4 xl:gap-1 xl:p-1 xl:bg-muted/30 rounded-full w-full xl:w-auto">
                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Project</div>
                    <ProjectCombobox
                        projects={projects}
                        currentProject={currentProject}
                        onSelect={(val) => updateFilter("projectId", val)}
                    />
                </div>

                <div className="h-px w-full bg-border/40 my-4 xl:hidden" />

                {/* Sort Filter */}
                <div className="flex flex-col w-full xl:w-auto">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 xl:hidden px-2">Sort</div>
                    <SortCombobox
                        currentSort={currentSort}
                        onSelect={(val) => updateFilter("sort", val)}
                    />
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
                        placeholder="Search tasks..."
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

function ProjectCombobox({
    projects,
    currentProject,
    onSelect
}: {
    projects: { id: string, name: string }[],
    currentProject: string | null,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "px-4 py-3 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 flex items-center justify-between xl:justify-center gap-2 w-full xl:w-auto bg-muted/30 xl:bg-transparent",
                        currentProject && currentProject !== "all"
                            ? "xl:bg-background shadow-sm text-foreground ring-1 ring-border/50 xl:ring-0"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Briefcase className="w-4 h-4 xl:w-3 xl:h-3 shrink-0" />
                        <span className="truncate max-w-[200px] xl:max-w-[250px]">
                            {currentProject && currentProject !== "all"
                                ? projects.find((project) => project.id === currentProject)?.name
                                : "ALL PROJECTS"}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 xl:h-3 xl:w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Search project..." />
                    <CommandList>
                        <CommandEmpty>No project found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all projects"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        !currentProject || currentProject === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All Projects
                            </CommandItem>
                            {projects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    value={project.name}
                                    onSelect={() => {
                                        onSelect(project.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentProject === project.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {project.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function SortCombobox({
    currentSort,
    onSelect
}: {
    currentSort: string,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)

    const sorts = [
        { label: "Newest First", value: "newest" },
        { label: "Oldest First", value: "oldest" },
        { label: "Recently Updated", value: "updated" },
        { label: "Name (A-Z)", value: "name_asc" },
        { label: "Name (Z-A)", value: "name_desc" },
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    className="px-4 py-3 xl:py-1.5 text-xs xl:text-[10px] font-bold rounded-xl xl:rounded-full transition-all duration-200 flex items-center justify-between xl:justify-center gap-2 w-full xl:w-auto bg-muted/30 xl:bg-transparent text-muted-foreground hover:text-foreground"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <ArrowUpDown className="w-4 h-4 xl:w-3 xl:h-3 shrink-0" />
                        <span className="truncate max-w-[200px] xl:max-w-[150px]">
                            {sorts.find((s) => s.value === currentSort)?.label || "SORT"}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 xl:h-3 xl:w-3 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="end">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {sorts.map((sort) => (
                                <CommandItem
                                    key={sort.value}
                                    value={sort.label}
                                    onSelect={() => {
                                        onSelect(sort.value)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentSort === sort.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {sort.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
