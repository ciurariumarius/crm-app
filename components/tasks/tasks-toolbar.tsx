"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Search, Briefcase, ChevronDown, Calendar, AlertCircle, ArrowUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
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

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-card rounded-[24px] xl:rounded-full p-2 shadow-sm border border-border/60 sticky top-4 z-40 backdrop-blur-xl bg-card/80">
            {/* Left: Search (Transparent) */}
            {/* Left: Search (Expandable) */}
            {/* Left: Search (Fixed Compact) */}
            <div className="relative w-full xl:w-[120px] 2xl:w-[150px] pl-4 pr-4 xl:pr-0">
                <Search className="absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-9 h-10 bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-xs"
                />
            </div>

            {/* Middle: Filters (Pills) */}
            <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto scrollbar-hide px-2">
                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">
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
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                (opt.value === "All" && (currentStatus === "All" || !currentStatus) || currentStatus === opt.value)
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-full">
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
                                "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                (opt.value === "all" && (!searchParams.get("urgency") || searchParams.get("urgency") === "all") || searchParams.get("urgency") === opt.value)
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                {/* Project Filter */}
                <div className="flex items-center p-1 bg-muted/30 rounded-full">
                    <ProjectCombobox
                        projects={projects}
                        currentProject={currentProject}
                        onSelect={(val) => updateFilter("projectId", val)}
                    />
                </div>

                <div className="w-px h-6 bg-border/40 mx-2 hidden sm:block" />

                {/* Sort Filter */}
                <div className="flex items-center p-1 bg-muted/30 rounded-full">
                    <SortCombobox
                        currentSort={currentSort}
                        onSelect={(val) => updateFilter("sort", val)}
                    />
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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-2",
                        currentProject && currentProject !== "all"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Briefcase className="w-3 h-3" />
                    <span className="max-w-[250px] truncate">
                        {currentProject && currentProject !== "all"
                            ? projects.find((project) => project.id === currentProject)?.name
                            : "ALL PROJECTS"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
                    className="px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                    <ArrowUpDown className="w-3 h-3" />
                    <span className="max-w-[150px] truncate">
                        {sorts.find((s) => s.value === currentSort)?.label || "SORT"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
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
