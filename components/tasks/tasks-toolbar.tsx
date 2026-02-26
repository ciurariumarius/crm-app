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

    const currentPriority = searchParams.get("urgency") || "all"

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 w-full z-40 mt-6 mb-8">
            <div className="flex flex-col md:flex-row items-center w-full xl:w-auto gap-4">
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
            <div className="flex items-center flex-wrap gap-2 w-full xl:w-auto xl:justify-end">
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
                    className="h-10 px-4 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all duration-200 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-border/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-muted-foreground hover:text-foreground"
                >
                    <Briefcase className="w-4 h-4 text-muted-foreground/40" />
                    <span className="truncate max-w-[200px]">
                        PROJECT: <span className="text-foreground">{currentProject && currentProject !== "all"
                            ? projects.find((project) => project.id === currentProject)?.name
                            : "ALL PROJECTS"}</span>
                    </span>
                    <ChevronDown className="ml-1 h-3 w-3 opacity-50" strokeWidth={3} />
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

function PriorityCombobox({
    currentPriority,
    onSelect
}: {
    currentPriority: string,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)

    const priorities = [
        { label: "ALL", value: "all" },
        { label: "URGENT", value: "Urgent" },
        { label: "IDEA", value: "Idea" },
        { label: "NORMAL", value: "Normal" }
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 px-4 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all duration-200 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-border/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-muted-foreground hover:text-foreground"
                >
                    <Filter className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <span>PRIORITY: <span className="text-foreground">{priorities.find((p) => p.value === currentPriority)?.label || "ALL"}</span></span>
                    <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" strokeWidth={3} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[150px] p-0" align="end">
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
                    className="h-10 px-4 text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all duration-200 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-border/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                    <ArrowUpDown className="w-4 h-4 shrink-0" />
                    <span>{sorts.find((s) => s.value === currentSort)?.label || "SORT"}</span>
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
