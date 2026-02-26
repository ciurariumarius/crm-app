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
import { Check, ChevronsUpDown, Filter, X, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { TasksViewToggle } from "@/components/tasks/tasks-view-toggle"

interface TasksToolbarProps {
    partners: { id: string; name: string }[]
    projects: { id: string; name: string }[]
    currentView?: "grid" | "list"
}

export function TasksToolbar({ partners, projects, currentView = "grid" }: TasksToolbarProps) {
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

    const currentPriority = searchParams.get("urgency") || "all"

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 w-full z-40 mt-1 md:mt-6 mb-4 md:mb-8">
            {/* Desktop Layout */}
            <div className="hidden md:flex flex-col md:flex-row items-center w-full xl:w-auto gap-4">
                {/* Search Input */}
                <div className={cn(
                    "flex items-center relative transition-all duration-300 ease-in-out bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] h-10 w-full xl:w-[280px]"
                )}>
                    <div className="pl-4 pr-2 text-muted-foreground/60 shrink-0">
                        <Search className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <Input
                        placeholder="FIND TASK..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="h-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-[10px] font-bold tracking-widest uppercase transition-all duration-300 w-full px-0"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="pr-4 pl-2 h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Status Wrapper */}
                <div className="flex bg-muted/40 dark:bg-zinc-900/50 p-1 rounded-xl border border-border/50 overflow-x-auto w-full md:w-auto hidescrollbar">
                    <div className="flex gap-1 min-w-max">
                        {[
                            { label: "ALL", value: "All" },
                            { label: "ACTIVE", value: "Active" },
                            { label: "PAUSED", value: "Paused" },
                            { label: "DONE", value: "Completed" }
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateFilter("status", opt.value)}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all duration-200 whitespace-nowrap",
                                    (opt.value === "All" && (currentStatus === "All" || !currentStatus) || currentStatus === opt.value)
                                        ? "bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400"
                                        : "text-muted-foreground/60 hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop Filters (Pills) */}
            <div className="hidden md:flex items-center flex-wrap gap-2 w-full xl:w-auto xl:justify-end">
                <TasksViewToggle currentView={currentView} />
                <ProjectCombobox
                    projects={projects}
                    currentProject={currentProject}
                    onSelect={(val) => updateFilter("projectId", val)}
                />
                <PriorityCombobox
                    currentPriority={currentPriority}
                    onSelect={(val) => updateFilter("urgency", val)}
                />
                <SortCombobox
                    currentSort={currentSort}
                    onSelect={(val) => updateFilter("sort", val)}
                />
            </div>

            {/* Mobile Layout */}
            <div className="flex md:hidden flex-col gap-4 w-full mt-2 overflow-hidden">
                <div className="flex flex-row items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 w-full hidescrollbar snap-x">
                    <StatusMobileCombobox currentStatus={currentStatus} onSelect={(val) => updateFilter("status", val)} />
                    <ProjectCombobox
                        projects={projects}
                        currentProject={currentProject}
                        onSelect={(val) => updateFilter("projectId", val)}
                    />

                    {/* Inline Mobile Search Pill */}
                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-border/60 shadow-sm rounded-xl h-10 px-3 shrink-0 focus-within:ring-1 focus-within:ring-blue-500 w-[140px] snap-start transition-colors">
                        <Search className="w-4 h-4 text-muted-foreground/40 shrink-0 mr-2" />
                        <Input
                            placeholder="SEARCH..."
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

                    <PriorityCombobox
                        currentPriority={currentPriority}
                        onSelect={(val) => updateFilter("urgency", val)}
                    />
                    <SortCombobox
                        currentSort={currentSort}
                        onSelect={(val) => updateFilter("sort", val)}
                    />
                </div>

                <div className="w-full mt-2">
                    <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/40 mb-1 ml-1">Ongoing Tasks</h2>
                </div>
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
    const isActive = currentProject && currentProject !== "all"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn(
                "flex items-center border shadow-sm rounded-xl h-10 overflow-hidden shrink-0 transition-colors snap-start",
                isActive
                    ? "bg-zinc-900 border-zinc-800 dark:bg-zinc-100 dark:border-border/60"
                    : "bg-white dark:bg-zinc-900 border-border/60"
            )}>
                <PopoverTrigger asChild>
                    <button
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "pl-4 pr-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 flex items-center gap-2 h-full",
                            isActive
                                ? "text-white dark:text-zinc-900 hover:bg-white/5 active:bg-white/10 dark:hover:bg-zinc-900/5"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <Briefcase className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-400 opacity-90" : "text-muted-foreground/40")} />
                        <span className="truncate max-w-[120px]">
                            {isActive
                                ? projects.find((project) => project.id === currentProject)?.name
                                : "Project"}
                        </span>
                        {!isActive && <ChevronDown className="ml-1 h-3 w-3 opacity-50 shrink-0" strokeWidth={3} />}
                    </button>
                </PopoverTrigger>
                {isActive && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect("all")
                        }}
                        className="pr-4 pl-3 py-2 h-full text-zinc-400 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 flex items-center justify-center transition-colors border-l border-white/10 dark:border-black/10 shrink-0"
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={3} />
                    </button>
                )}
            </div>
            <PopoverContent className="w-[400px] p-0" align="start">
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

function PriorityCombobox({
    currentPriority,
    onSelect
}: {
    currentPriority: string,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentPriority && currentPriority !== "all"

    const priorities = [
        { label: "ALL", value: "all" },
        { label: "URGENT", value: "Urgent" },
        { label: "IDEA", value: "Idea" },
        { label: "NORMAL", value: "Normal" }
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn(
                "flex items-center border shadow-sm rounded-xl h-10 overflow-hidden shrink-0 transition-colors snap-start",
                isActive
                    ? "bg-zinc-900 border-zinc-800 dark:bg-zinc-100 dark:border-border/60"
                    : "bg-white dark:bg-zinc-900 border-border/60"
            )}>
                <PopoverTrigger asChild>
                    <button
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "pl-4 pr-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 flex items-center gap-2 h-full",
                            isActive
                                ? "text-white dark:text-zinc-900 hover:bg-white/5 active:bg-white/10 dark:hover:bg-zinc-900/5"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <Filter className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-400 opacity-90" : "text-muted-foreground/40")} />
                        <span className="truncate max-w-[80px]">{isActive ? priorities.find((p) => p.value === currentPriority)?.label : "Priority"}</span>
                        {!isActive && <ChevronDown className="ml-1 h-3 w-3 opacity-50 shrink-0" strokeWidth={3} />}
                    </button>
                </PopoverTrigger>
                {isActive && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect("all")
                        }}
                        className="pr-4 pl-3 py-2 h-full text-zinc-400 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 flex items-center justify-center transition-colors border-l border-white/10 dark:border-black/10 shrink-0"
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={3} />
                    </button>
                )}
            </div>
            <PopoverContent className="w-[150px] p-0" align="start">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {priorities.map((priority) => (
                                <CommandItem
                                    key={priority.value}
                                    value={priority.label}
                                    onSelect={() => {
                                        onSelect(priority.value)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentPriority === priority.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {priority.label}
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
    const isActive = currentSort && currentSort !== "newest"

    const sorts = [
        { label: "Newest First", value: "newest" },
        { label: "Oldest First", value: "oldest" },
        { label: "Recently Updated", value: "updated" },
        { label: "Name (A-Z)", value: "name_asc" },
        { label: "Name (Z-A)", value: "name_desc" },
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn(
                "flex items-center border shadow-sm rounded-xl h-10 overflow-hidden shrink-0 transition-colors snap-start",
                isActive
                    ? "bg-zinc-900 border-zinc-800 dark:bg-zinc-100 dark:border-border/60"
                    : "bg-white dark:bg-zinc-900 border-border/60"
            )}>
                <PopoverTrigger asChild>
                    <button
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "pl-4 pr-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 flex items-center gap-2 h-full",
                            isActive
                                ? "text-white dark:text-zinc-900 hover:bg-white/5 active:bg-white/10 dark:hover:bg-zinc-900/5"
                                : "text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-muted/50"
                        )}
                    >
                        <ArrowUpDown className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-400 opacity-90" : "text-blue-600 dark:text-blue-400")} />
                        <span className="truncate max-w-[100px]">{isActive ? sorts.find((s) => s.value === currentSort)?.label : "Sort"}</span>
                        {!isActive && <ChevronDown className="ml-1 h-3 w-3 opacity-50 shrink-0" strokeWidth={3} />}
                    </button>
                </PopoverTrigger>
                {isActive && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect("newest")
                        }}
                        className="pr-4 pl-3 py-2 h-full text-zinc-400 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 flex items-center justify-center transition-colors border-l border-white/10 dark:border-black/10 shrink-0"
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={3} />
                    </button>
                )}
            </div>
            <PopoverContent className="w-[200px] p-0" align="start">
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

function StatusMobileCombobox({
    currentStatus,
    onSelect
}: {
    currentStatus: string,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)

    const statuses = [
        { label: "ALL", value: "All" },
        { label: "ACTIVE", value: "Active" },
        { label: "PAUSED", value: "Paused" },
        { label: "DONE", value: "Completed" }
    ]

    const activeObj = statuses.find((s) => s.value === currentStatus) || statuses[1]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 dark:bg-zinc-100 dark:border-border/60 shadow-sm rounded-xl h-10 overflow-hidden shrink-0 snap-start">
                <PopoverTrigger asChild>
                    <button
                        role="combobox"
                        aria-expanded={open}
                        className="pl-4 pr-3 py-2 text-[10px] font-bold tracking-widest text-white dark:text-zinc-900 uppercase transition-all duration-200 flex items-center gap-2 hover:bg-white/5 active:bg-white/10 dark:hover:bg-zinc-900/5 h-full"
                    >
                        <Layers className="w-4 h-4 text-blue-400 opacity-90 shrink-0" strokeWidth={2.5} />
                        <span>{activeObj.label}</span>
                    </button>
                </PopoverTrigger>
                {currentStatus !== "All" && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelect("All")
                        }}
                        className="pr-4 pl-3 py-2 h-full text-zinc-400 hover:text-white dark:text-zinc-600 dark:hover:text-zinc-900 flex items-center justify-center transition-colors border-l border-white/10 dark:border-black/10"
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={3} />
                    </button>
                )}
            </div>
            <PopoverContent className="w-[150px] p-0" align="start">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {statuses.map((s) => (
                                <CommandItem
                                    key={s.value}
                                    value={s.label}
                                    onSelect={() => {
                                        onSelect(s.value)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentStatus === s.value || (s.value === 'Active' && !currentStatus) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {s.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
