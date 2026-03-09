"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Check, ChevronDown, Briefcase, Users, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TasksToolbarProps {
    projects: { id: string; name: string }[]
    partners: { id: string; name: string }[]
    totalTasks: number
}

function statusPillClass(currentStatus: string, option: string) {
    return cn(
        "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
        currentStatus === option && option === "Active" && "bg-[#2563EB] text-white shadow-sm ring-1 ring-[#1D4ED8]",
        currentStatus === option && option === "Paused" && "bg-[#F59E0B] text-white shadow-sm ring-1 ring-[#D97706]",
        currentStatus === option && option === "Completed" && "bg-[#10B981] text-white shadow-sm ring-1 ring-[#059669]",
        currentStatus === option && option === "All" && "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300",
        currentStatus !== option && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
    )
}

function urgencyPillClass(currentUrgency: string, option: string) {
    return cn(
        "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
        currentUrgency === option && option === "Urgent" && "bg-[#E11D48] text-white shadow-sm ring-1 ring-[#BE123C]",
        currentUrgency === option && option === "Normal" && "bg-[#2563EB] text-white shadow-sm ring-1 ring-[#1D4ED8]",
        currentUrgency === option && option === "Idea" && "bg-[#F59E0B] text-white shadow-sm ring-1 ring-[#D97706]",
        currentUrgency === option && option === "all" && "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300",
        currentUrgency !== option && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
    )
}

export function TasksToolbar({ projects, partners, totalTasks }: TasksToolbarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentQ = searchParams.get("q")?.trim() || ""
    const currentStatus = searchParams.get("status") || "Active"
    const currentUrgency = searchParams.get("urgency") || "all"
    const currentProject = searchParams.get("projectId") || "all"
    const currentPartner = searchParams.get("partnerId") || "all"
    const currentSort = searchParams.get("sort") || "newest"
    const currentView = searchParams.get("view") || "grid"
    const currentCols = searchParams.get("cols") || "3"

    const selectedProject = projects.find((project) => project.id === currentProject)
    const selectedPartner = partners.find((partner) => partner.id === currentPartner)

    const buildHref = (overrides: Record<string, string | null | undefined>) => {
        const next = new URLSearchParams()

        if (currentQ) next.set("q", currentQ)
        if (currentStatus) next.set("status", currentStatus)
        if (currentUrgency !== "all") next.set("urgency", currentUrgency)
        if (currentProject !== "all") next.set("projectId", currentProject)
        if (currentPartner !== "all") next.set("partnerId", currentPartner)
        if (currentSort) next.set("sort", currentSort)
        if (currentView) next.set("view", currentView)
        if (currentCols) next.set("cols", currentCols)
        next.set("page", "1")

        for (const [key, value] of Object.entries(overrides)) {
            if (
                value === null ||
                value === undefined ||
                value === "" ||
                ((key === "projectId" || key === "partnerId" || key === "urgency") && value === "all")
            ) {
                next.delete(key)
            } else {
                next.set(key, value)
            }
        }

        return `/tasks?${next.toString()}`
    }

    const pushWithOverrides = (overrides: Record<string, string | null | undefined>) => {
        router.push(buildHref(overrides))
    }

    const activeFilters: { key: string; label: string; href: string }[] = []
    if (currentQ) activeFilters.push({ key: "q", label: `Search: ${currentQ}`, href: buildHref({ q: null }) })
    if (currentStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${currentStatus}`, href: buildHref({ status: "Active" }) })
    if (currentUrgency !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${currentUrgency}`, href: buildHref({ urgency: "all" }) })
    if (currentProject !== "all") activeFilters.push({ key: "projectId", label: `Project: ${selectedProject?.name || "Selected"}`, href: buildHref({ projectId: null }) })
    if (currentPartner !== "all") activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner?.name || "Selected"}`, href: buildHref({ partnerId: null }) })

    const clearAllHref = buildHref({
        q: null,
        status: "Active",
        urgency: "all",
        projectId: null,
        partnerId: null,
    })

    const resultsSummaryParts = [`${totalTasks} results`, `Status: ${currentStatus}`]
    if (currentUrgency !== "all") resultsSummaryParts.push(`Priority: ${currentUrgency}`)
    if (selectedProject) resultsSummaryParts.push(`Project: ${selectedProject.name}`)
    if (selectedPartner) resultsSummaryParts.push(`Partner: ${selectedPartner.name}`)
    const resultsSummary = resultsSummaryParts.join(" · ")

    return (
        <div className="md:sticky md:top-3 z-20 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 md:px-4 md:py-4 shadow-sm backdrop-blur-[6px]">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                        <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                            {[
                                { label: "All", value: "All" },
                                { label: "Active", value: "Active" },
                                { label: "Paused", value: "Paused" },
                                { label: "Completed", value: "Completed" },
                            ].map((option) => (
                                <Link
                                    key={option.value}
                                    href={buildHref({ status: option.value })}
                                    className={statusPillClass(currentStatus, option.value)}
                                >
                                    {option.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Priority</p>
                        <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                            {[
                                { label: "All", value: "all" },
                                { label: "Urgent", value: "Urgent" },
                                { label: "Normal", value: "Normal" },
                                { label: "Idea", value: "Idea" },
                            ].map((option) => (
                                <Link
                                    key={option.value}
                                    href={buildHref({ urgency: option.value })}
                                    className={urgencyPillClass(currentUrgency, option.value)}
                                >
                                    {option.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="ml-auto flex flex-wrap items-end gap-2">
                        <ProjectCombobox
                            projects={projects}
                            currentProject={currentProject}
                            onSelect={(value) => {
                                const overrides: Record<string, string | null | undefined> = { projectId: value }
                                if (value !== "all") overrides.partnerId = null
                                pushWithOverrides(overrides)
                            }}
                        />

                        <PartnerCombobox
                            partners={partners}
                            currentPartner={currentPartner}
                            onSelect={(value) => {
                                const overrides: Record<string, string | null | undefined> = { partnerId: value }
                                if (value !== "all") overrides.projectId = null
                                pushWithOverrides(overrides)
                            }}
                        />

                        <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] text-slate-500 font-semibold" title={resultsSummary}>
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline max-w-[420px] truncate">{resultsSummary}</span>
                            <span className="xl:hidden">{totalTasks} results</span>
                        </div>
                    </div>
                </div>

                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Active filters</span>
                        {activeFilters.map((filter) => (
                            <Link
                                key={filter.key}
                                href={filter.href}
                                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-2.5 pr-2 text-[11px] font-medium text-slate-700 hover:bg-white"
                                title={`Remove ${filter.label}`}
                            >
                                <span className="max-w-[200px] truncate">{filter.label}</span>
                                <X className="h-3 w-3 text-slate-400" />
                            </Link>
                        ))}
                        <Link
                            href={clearAllHref}
                            className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Clear all
                        </Link>
                    </div>
                )}
            </div>
        </div>
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
                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] transition-colors",
                        isActive
                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                >
                    <Briefcase className={cn("h-4 w-4", isActive ? "text-[#3B82F6]" : "text-slate-400")} />
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
                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] transition-colors",
                        isActive
                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                >
                    <Users className={cn("h-4 w-4", isActive ? "text-[#3B82F6]" : "text-slate-400")} />
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
