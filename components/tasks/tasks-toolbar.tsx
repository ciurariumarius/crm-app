"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    Circle,
    CheckCheck,
    LayoutGrid,
    Play,
    AlertTriangle,
    Lightbulb,
    CalendarClock,
    X,
    SlidersHorizontal,
    Briefcase,
    Users,
    ChevronDown,
    ArrowUpDown,
    Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
    currentSort,
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
    currentSort: string
    currentProject: string
    currentPartner: string
    totalTasks: number
    mobileSecondaryOnly?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            const isDefaultStatus = key === "status" && value === "Active"
            const isDefaultUrgency = key === "urgency" && value === "all"
            const isDefaultSort = key === "sort" && value === "newest"
            const isDefaultProject = key === "projectId" && value === "all"
            const isDefaultPartner = key === "partnerId" && value === "all"

            if (
                value === null ||
                isDefaultStatus ||
                isDefaultUrgency ||
                isDefaultSort ||
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
        sort: "newest",
        projectId: null,
        partnerId: null,
    })

    const selectedProject = projects.find(p => p.id === currentProject)
    const selectedPartner = partners.find(p => p.id === currentPartner)

    const resultsSummaryParts = [`${totalTasks} results`]
    if (currentOverdue) resultsSummaryParts.push("Overdue")
    if (selectedProject) resultsSummaryParts.push(`Project: ${selectedProject.name}`)
    if (selectedPartner) resultsSummaryParts.push(`Partner: ${selectedPartner.name}`)
    const resultsSummary = resultsSummaryParts.join(" · ")

    const activeFilters: { key: string; label: string; href: string }[] = []
    if (currentStatus && currentStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${currentStatus}`, href: buildHref({ status: "Active" }) })
    if (currentUrgency && currentUrgency !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${currentUrgency}`, href: buildHref({ urgency: "all" }) })
    if (currentOverdue) activeFilters.push({ key: "overdue", label: "Overdue", href: buildHref({ overdue: null }) })
    if (currentProject && currentProject !== "all" && selectedProject) activeFilters.push({ key: "projectId", label: `Project: ${selectedProject.name}`, href: buildHref({ projectId: null }) })
    if (currentPartner && currentPartner !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner.name}`, href: buildHref({ partnerId: null }) })

    return (
        <div className="md:sticky md:top-3 z-20 rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-4 shadow-sm backdrop-blur-md">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-6">
                        <div className={cn(mobileSecondaryOnly && "hidden")}>
                            <div className="inline-flex h-11 items-center rounded-2xl border border-slate-300/40 bg-slate-200/50 p-1 shadow-inner">
                                {[
                                    { label: "All", value: "All", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                                    { label: "Active", value: "Active", icon: <Play className="h-3.5 w-3.5 fill-current" /> },
                                    { label: "Completed", value: "Completed", icon: <CheckCheck className="h-3.5 w-3.5" /> },
                                ].map((option) => (
                                    <Link
                                        key={option.value}
                                        href={buildHref({ status: option.value })}
                                        className={cn(
                                            "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all",
                                            currentStatus === option.value
                                                ? "bg-white text-blue-700 shadow-md ring-1 ring-black/[0.05] scale-[1.02]"
                                                : "text-slate-600 hover:text-slate-900"
                                        )}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className={cn(mobileSecondaryOnly && "hidden")}>
                            <div className="inline-flex h-11 items-center rounded-2xl border border-slate-300/40 bg-slate-200/50 p-1 shadow-inner">
                                {[
                                    { label: "All", value: "all", icon: <Circle className="h-3.5 w-3.5" /> },
                                    { label: "Urgent", value: "Urgent", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
                                    { label: "Normal", value: "Normal", icon: <Circle className="h-3.5 w-3.5 fill-current" /> },
                                    { label: "Idea", value: "Idea", icon: <Lightbulb className="h-3.5 w-3.5" /> },
                                ].map((option) => (
                                    <Link
                                        key={option.value}
                                        href={buildHref({ urgency: option.value })}
                                        className={cn(
                                            "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all",
                                            currentUrgency === option.value
                                                ? "bg-white text-blue-700 shadow-md ring-1 ring-black/[0.05] scale-[1.02]"
                                                : "text-slate-600 hover:text-slate-900"
                                        )}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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

                        <div className="hidden h-7 w-px bg-slate-200 sm:block mx-1" />

                        <SortCombobox
                            currentSort={currentSort}
                            onSelect={(value) => {
                                pushWithOverrides({ sort: value })
                            }}
                        />

                        <Link
                            href={buildHref({ overdue: currentOverdue ? null : "1" })}
                            className={cn(
                                "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition-all shadow-sm",
                                currentOverdue
                                    ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                                    : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
                            )}
                            title={currentOverdue ? "Show all deadlines" : "Show only overdue tasks"}
                        >
                            <CalendarClock className={cn("h-4 w-4", currentOverdue ? "text-blue-600" : "text-slate-400")} />
                            <span>Overdue</span>
                        </Link>

                        <div className="hidden h-7 w-px bg-slate-200 sm:block mx-1" />

                        <div className="h-9 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 text-[11px] font-extrabold text-slate-500 ring-1 ring-slate-200/50" title={resultsSummary}>
                            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                            <span>{totalTasks}</span>
                        </div>
                    </div>
                </div>

                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        {activeFilters.map((filter) => (
                            <Link
                                key={filter.key}
                                href={filter.href}
                                className="group inline-flex h-7 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 pl-2 pr-1.5 text-[10px] font-extrabold text-blue-700 transition-all hover:bg-blue-100"
                                title={`Remove ${filter.label}`}
                            >
                                <span className="max-w-[150px] truncate">{filter.label}</span>
                                <X className="h-2.5 w-2.5 opacity-60" />
                            </Link>
                        ))}
                        <Link
                            href={clearAllHref}
                            className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-extrabold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
                        >
                            Clear all
                        </Link>
                    </div>
                )}
            </div>
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
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-sm",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
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
                        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition-all shadow-sm",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
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
                        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition-all shadow-sm",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
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
