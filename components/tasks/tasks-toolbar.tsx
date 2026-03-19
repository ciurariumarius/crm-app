"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    Circle,
    Play,
    CheckCircle2,
    AlertTriangle,
    Lightbulb,
    CalendarClock,
    Briefcase,
    Users,
    ChevronDown,
    ArrowUpDown,
    Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    FilterBarDivider,
    FilterBarGroup,
    FilterBarRow,
    FilterBarScroll,
    FilterBarShell,
    FilterResultsRow,
} from "@/components/ui/filter-bar"
import { buttonLinkClassName } from "@/components/ui/button-link"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { useTasksSearchContext } from "./tasks-search-context"

const SORT_OPTIONS = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Recently Updated", value: "updated" },
    { label: "Name A-Z", value: "name_asc" },
    { label: "Name Z-A", value: "name_desc" },
]

export function TasksToolbar({
    projects,
    partners,
    currentStatus,
    currentUrgency,
    currentOverdue,
    currentDueToday,
    currentSort,
    currentCols,
    currentProject,
    currentPartner,
    totalTasks,
    mobileSecondaryOnly = false,
}: {
    projects: { id: string; name: string }[]
    partners: { id: string; name: string }[]
    currentStatus: string
    currentUrgency: string
    currentOverdue: boolean
    currentDueToday: boolean
    currentSort: string
    currentCols: number
    currentProject: string
    currentPartner: string
    totalTasks: number
    mobileSecondaryOnly?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const searchContext = useTasksSearchContext()

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            const isDefaultStatus = key === "status" && value === "Active"
            const isDefaultUrgency = key === "urgency" && value === "all"
            const isDefaultSort = key === "sort" && value === "newest"
            const isDefaultCols = key === "cols" && value === "3"
            const isDefaultProject = key === "projectId" && value === "all"
            const isDefaultPartner = key === "partnerId" && value === "all"

            if (
                value === null ||
                isDefaultStatus ||
                isDefaultUrgency ||
                isDefaultSort ||
                isDefaultCols ||
                isDefaultProject ||
                isDefaultPartner
            ) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        return `${pathname}?${params.toString()}`
    }

    const pushWithOverrides = (overrides: Record<string, string | null>) => {
        router.push(buildHref(overrides))
    }

    const clearAllHref = buildHref({
        status: "Active",
        urgency: "all",
        overdue: null,
        dueToday: null,
        sort: "newest",
        projectId: null,
        partnerId: null,
    })
    const hasSearchTerm = Boolean(searchContext?.searchTerm.trim())
    const searchResultCount = searchContext?.searchResultCount
    const displayTotal = hasSearchTerm && searchResultCount !== null && searchResultCount !== undefined
        ? searchResultCount
        : totalTasks

    const selectedProject = projects.find((project) => project.id === currentProject)
    const selectedPartner = partners.find((partner) => partner.id === currentPartner)
    const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSort)
    const activeFilters: { key: string; label: string; href: string }[] = []
    if (currentStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${currentStatus}`, href: buildHref({ status: "Active" }) })
    if (currentUrgency !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${currentUrgency}`, href: buildHref({ urgency: "all" }) })
    if (currentOverdue) activeFilters.push({ key: "overdue", label: "Overdue", href: buildHref({ overdue: null }) })
    if (currentDueToday) activeFilters.push({ key: "dueToday", label: "Due today", href: buildHref({ dueToday: null }) })
    if (currentProject !== "all" && selectedProject) activeFilters.push({ key: "projectId", label: `Project: ${selectedProject.name}`, href: buildHref({ projectId: "all" }) })
    if (currentPartner !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner.name}`, href: buildHref({ partnerId: "all" }) })
    if (currentSort !== "newest" && selectedSort) activeFilters.push({ key: "sort", label: `Sort: ${selectedSort.label}`, href: buildHref({ sort: "newest" }) })

    return (
        <div className="space-y-3">
            <FilterBarShell>
                <FilterBarScroll>
                    <FilterBarRow>
                        <FilterBarGroup className={cn(mobileSecondaryOnly && "hidden")}>
                            <div className="inline-flex h-10 items-center gap-1">
                                {[
                                    {
                                        label: "All",
                                        value: "All",
                                        icon: <Circle className="h-2.5 w-2.5 fill-current" />,
                                        activeClass: "bg-slate-100 text-slate-700",
                                    },
                                    {
                                        label: "Active",
                                        value: "Active",
                                        icon: <Play className="h-2.5 w-2.5 fill-current" />,
                                        activeClass: "bg-blue-100 text-blue-700",
                                    },
                                    {
                                        label: "Completed",
                                        value: "Completed",
                                        icon: <CheckCircle2 className="h-3 w-3" />,
                                        activeClass: "bg-emerald-100 text-emerald-700",
                                    },
                                ].map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ status: option.value })}
                                            className={cn(
                                                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                                currentStatus === option.value
                                                    ? option.activeClass
                                                    : "text-slate-600 hover:text-slate-800"
                                            )}
                                        >
                                            {option.icon}
                                            {option.label}
                                        </Link>
                                ))}
                            </div>

                            <FilterBarDivider className="md:mx-1" />

                            <div className="inline-flex h-10 items-center gap-1">
                                    {[
                                        { label: "All", value: "all", icon: <Circle className="h-3 w-3" /> },
                                        { label: "Urgent", value: "Urgent", icon: <AlertTriangle className="h-3 w-3 text-rose-500" /> },
                                        { label: "Normal", value: "Normal", icon: <Circle className="h-3 w-3 fill-current" /> },
                                        { label: "Idea", value: "Idea", icon: <Lightbulb className="h-3 w-3 text-amber-500" /> },
                                    ].map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ urgency: option.value })}
                                            className={cn(
                                                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                                currentUrgency === option.value
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "text-slate-600 hover:text-slate-800"
                                            )}
                                        >
                                            {option.icon}
                                            {option.label}
                                        </Link>
                                    ))}
                            </div>
                        </FilterBarGroup>

                        <FilterBarDivider className={cn("md:mx-1", mobileSecondaryOnly && "hidden")} />

                        <Link
                            href={buildHref({ overdue: currentOverdue ? null : "1" })}
                            className={cn(
                                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
                                currentOverdue
                                    ? "border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>Overdue</span>
                            {currentOverdue ? (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-200/80 text-rose-700">
                                    <Check className="h-3 w-3" />
                                </span>
                            ) : null}
                        </Link>

                        <FilterBarDivider className="md:mx-1" />

                        <ProjectCombobox
                            projects={projects}
                            currentProject={currentProject}
                            onSelect={(value) => {
                                const overrides: Record<string, string | null> = { projectId: value }
                                if (value !== "all") overrides.partnerId = null
                                pushWithOverrides(overrides)
                            }}
                        />

                        <PartnerCombobox
                            partners={partners}
                            currentPartner={currentPartner}
                            onSelect={(value) => {
                                const overrides: Record<string, string | null> = { partnerId: value }
                                if (value !== "all") overrides.projectId = null
                                pushWithOverrides(overrides)
                            }}
                        />

                        <FilterBarDivider className="md:ml-auto md:mr-1" />

                        <SortCombobox
                            currentSort={currentSort}
                            onSelect={(value) => {
                                pushWithOverrides({ sort: value })
                            }}
                        />

                        <ColumnsToggle
                            currentCols={currentCols}
                            onSelect={(value) => {
                                pushWithOverrides({ cols: String(value) })
                            }}
                        />
                    </FilterBarRow>
                </FilterBarScroll>
            </FilterBarShell>

            <FilterResultsRow>
                <p className="ui-text-label">
                    {searchContext?.isSearching ? "Searching..." : `${displayTotal} Results found`}
                </p>
                {activeFilters.length > 0 && <span className="text-slate-300">|</span>}
                {activeFilters.map((filter) => (
                    <Link
                        key={filter.key}
                        href={filter.href}
                        className={buttonLinkClassName({ size: "sm", variant: "subtle", className: "gap-1 text-[12px]" })}
                    >
                        <span>{filter.label}</span>
                    </Link>
                ))}
                {activeFilters.length > 0 && (
                    <Link
                        href={clearAllHref}
                        className={buttonLinkClassName({ size: "sm", variant: "subtle", emphasis: "strong", className: "text-[12px]" })}
                    >
                        Clear all
                    </Link>
                )}
            </FilterResultsRow>
        </div>
    )
}

function ColumnsToggle({
    currentCols,
    onSelect,
}: {
    currentCols: number
    onSelect: (value: 3 | 4) => void
}) {
    return (
        <div className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white p-1">
            {[3, 4].map((col) => (
                <button
                    key={col}
                    type="button"
                    title={`${col} columns`}
                    onClick={() => onSelect(col as 3 | 4)}
                    className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
                        currentCols === col
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    {col}
                </button>
            ))}
        </div>
    )
}

function SortCombobox({
    currentSort,
    onSelect,
}: {
    currentSort: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentSort !== "newest"
    const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSort) ?? SORT_OPTIONS[0]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={`Sort: ${selectedSort.label}`}
                    aria-label={`Sort: ${selectedSort.label}`}
                    className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <ArrowUpDown className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
                    <CommandList>
                        <CommandGroup>
                            {SORT_OPTIONS.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onSelect(option.value)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentSort === option.value ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function ProjectCombobox({
    projects,
    currentProject,
    onSelect,
}: {
    projects: { id: string; name: string }[]
    currentProject: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentProject !== "all"
    const selectedProject = projects.find((project) => project.id === currentProject)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Briefcase className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[180px] truncate">{selectedProject?.name || "Project"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
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
                                className="cursor-pointer rounded-lg"
                            >
                                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                                All projects
                            </CommandItem>
                            {projects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    value={project.name}
                                    onSelect={() => {
                                        onSelect(project.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentProject === project.id ? "opacity-100" : "opacity-0")} />
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

function PartnerCombobox({
    partners,
    currentPartner,
    onSelect,
}: {
    partners: { id: string; name: string }[]
    currentPartner: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentPartner !== "all"
    const selectedPartner = partners.find((partner) => partner.id === currentPartner)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Users className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[180px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
                    <CommandInput placeholder="Search partner..." />
                    <CommandList>
                        <CommandEmpty>No partner found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all partners"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                                className="cursor-pointer rounded-lg"
                            >
                                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                                All partners
                            </CommandItem>
                            {partners.map((partner) => (
                                <CommandItem
                                    key={partner.id}
                                    value={partner.name}
                                    onSelect={() => {
                                        onSelect(partner.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentPartner === partner.id ? "opacity-100" : "opacity-0")} />
                                    {partner.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
