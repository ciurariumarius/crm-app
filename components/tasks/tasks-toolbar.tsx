"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    AlertTriangle,
    Lightbulb,
    CalendarClock,
    ChevronDown,
    SlidersHorizontal,
    Check,
    LayoutGrid,
    Table2,
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

const STATUS_OPTIONS = [
    { label: "All", value: "All", dotClass: "bg-slate-400", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
    { label: "Active", value: "Active", dotClass: "bg-emerald-500", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
    { label: "Completed", value: "Completed", dotClass: "bg-cyan-700", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
]

const PRIORITY_OPTIONS = [
    { label: "All", value: "all", icon: <span className="h-2 w-2 rounded-full bg-slate-400" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
    { label: "Urgent", value: "Urgent", icon: <AlertTriangle className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
    { label: "Normal", value: "Normal", icon: <span className="h-2 w-2 rounded-full bg-slate-500" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
    { label: "Idea", value: "Idea", icon: <Lightbulb className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
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
    const resultsLabel = searchContext?.isSearching ? "Searching..." : `${displayTotal} Results found`

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
        <div className="space-y-2.5 sm:space-y-3">
            <FilterBarShell className="rounded-[24px] border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] sm:px-5 sm:py-4">
                <FilterBarScroll>
                    <FilterBarRow className="items-center md:gap-4">
                        <FilterBarGroup>
                            <div className="inline-flex h-10 items-center rounded-xl bg-[var(--bg-surface-soft)] p-1">
                                {STATUS_OPTIONS.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ status: option.value })}
                                            className={cn(
                                                "inline-flex h-8 items-center gap-2 rounded-md px-3 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors",
                                                currentStatus === option.value
                                                    ? option.activeClass
                                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            )}
                                        >
                                            {option.value !== "All" ? (
                                                <span className={cn("h-2 w-2 rounded-full", option.dotClass)} />
                                            ) : null}
                                            {option.label}
                                        </Link>
                                ))}
                            </div>

                            <FilterBarDivider className="md:mx-2" />

                            <div className="inline-flex h-10 items-center rounded-xl bg-[var(--bg-surface-soft)] p-1">
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ urgency: option.value })}
                                            className={cn(
                                                "inline-flex h-8 items-center gap-2 rounded-md px-3 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors",
                                                currentUrgency === option.value
                                                    ? option.activeClass
                                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            )}
                                        >
                                            {option.value !== "all" ? option.icon : null}
                                            {option.label}
                                        </Link>
                                    ))}
                            </div>
                        </FilterBarGroup>

                        <FilterBarDivider className="md:mx-2" />

                        <Link
                            href={buildHref({ overdue: currentOverdue ? null : "1" })}
                            className={cn(
                                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
                                currentOverdue
                                    ? "border-[color:color-mix(in_srgb,var(--state-overdue)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_14%,white)] text-[var(--state-overdue)] ring-1 ring-[color:color-mix(in_srgb,var(--state-overdue)_22%,transparent)]"
                                    : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                            )}
                        >
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>Overdue</span>
                            {currentOverdue ? (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--state-overdue)_24%,white)] text-[var(--state-overdue)]">
                                    <Check className="h-3 w-3" />
                                </span>
                            ) : null}
                        </Link>

                        <FilterBarDivider className="md:mx-2" />

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

                        <FilterBarDivider className="md:ml-auto md:mr-2" />

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

            <FilterResultsRow className="justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.025)] sm:gap-4 sm:px-4 sm:py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{resultsLabel}</p>
                    {activeFilters.length > 0 && <span className="text-[var(--line-subtle)]">|</span>}
                    {activeFilters.map((filter) => (
                        <Link
                            key={filter.key}
                            href={filter.href}
                            className="inline-flex h-7 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,white)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_12%,white)] px-2.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--brand-primary)]"
                        >
                            <span>{filter.label}</span>
                        </Link>
                    ))}
                    {activeFilters.length > 0 && (
                        <Link
                            href={clearAllHref}
                            className="inline-flex h-7 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 transition-colors hover:text-slate-800"
                        >
                            Clear all
                        </Link>
                    )}
                </div>
                <div className="hidden items-center gap-2 md:flex">
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--brand-primary)]"
                        title="Board view"
                        aria-label="Board view"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                        title="Table view"
                        aria-label="Table view"
                    >
                        <Table2 className="h-4 w-4" />
                    </button>
                </div>
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
        <div className="inline-flex h-10 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-1">
            {[3, 4].map((col) => (
                <button
                    key={col}
                    type="button"
                    title={`${col} columns`}
                    onClick={() => onSelect(col as 3 | 4)}
                    className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
                        currentCols === col
                            ? "bg-white text-[var(--text-primary)] shadow-sm"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                            : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                    )}
                >
                    <SlidersHorizontal className={cn("h-4 w-4", isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]")} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-0 shadow-[var(--shadow-apple)]">
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
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                            : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                    )}
                >
                    <span className="max-w-[180px] truncate">{selectedProject?.name || "Project"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-0 shadow-[var(--shadow-apple)]">
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
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                            : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                    )}
                >
                    <span className="max-w-[180px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-0 shadow-[var(--shadow-apple)]">
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
