"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { User, Briefcase, X, ChevronDown, Check, Clock } from "lucide-react"
import { cn, formatProjectName } from "@/lib/utils"
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
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buttonLinkClassName } from "@/components/ui/button-link"
import {
    FilterBarDivider,
    FilterBarGroup,
    FilterBarRow,
    FilterBarScroll,
    FilterBarShell,
    FilterResultsRow,
} from "@/components/ui/filter-bar"

type PaymentsPartnerOption = {
    id: string
    name: string
}

type PaymentsProjectOption = {
    id: string
    name?: string | null
    createdAt?: string | Date | null
    site?: {
        domainName?: string | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
}

interface PaymentsFiltersProps {
    partners: PaymentsPartnerOption[]
    projects: PaymentsProjectOption[]
    totalLogs: number
}

export function PaymentsFilters({ partners, projects, totalLogs }: PaymentsFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentPartnerId = searchParams.get("partnerId") || "all"
    const currentProjectId = searchParams.get("projectId") || "all"
    const currentTimeRange = searchParams.get("timeRange") || "all"
    const currentSearch = searchParams.get("q") || ""

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            if (value === null || value === "all") {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        params.delete("page")
        return `/payments?${params.toString()}`
    }

    const pushWithOverrides = (overrides: Record<string, string | null>) => {
        router.push(buildHref(overrides))
    }

    const clearAllHref = "/payments"
    const selectedProject = projects.find((p) => p.id === currentProjectId)
    const selectedPartner = partners.find((p) => p.id === currentPartnerId)
    const activeFilters: { key: string; label: string; href: string }[] = []
    
    if (currentSearch) {
        activeFilters.push({
            key: "q",
            label: `Search: ${currentSearch}`,
            href: buildHref({ q: null })
        })
    }
    if (currentPartnerId !== "all" && selectedPartner) {
        activeFilters.push({ 
            key: "partnerId", 
            label: `Partner: ${selectedPartner.name}`, 
            href: buildHref({ partnerId: "all" }) 
        })
    }
    if (currentProjectId !== "all" && selectedProject) {
        activeFilters.push({ 
            key: "projectId", 
            label: `Project: ${formatProjectName(selectedProject)}`, 
            href: buildHref({ projectId: "all" }) 
        })
    }

    const timeRangeLabels: Record<string, string> = {
        "7d": "Last 7 Days",
        "30d": "Last 30 Days",
        "this_month": "This Month",
        "last_month": "Last Month"
    }

    if (currentTimeRange !== "all" && timeRangeLabels[currentTimeRange]) {
        activeFilters.push({
            key: "timeRange",
            label: timeRangeLabels[currentTimeRange],
            href: buildHref({ timeRange: "all" })
        })
    }

    return (
        <div className="space-y-2.5 sm:space-y-3">
            <FilterBarShell className="rounded-[24px] border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] sm:px-5 sm:py-4">
                <FilterBarScroll>
                    <FilterBarRow className="xl:gap-4">
                    <FilterBarGroup className="gap-4 xl:gap-4">
                        <PartnerCombobox
                            partners={partners}
                            currentPartner={currentPartnerId}
                            onSelect={(value) => pushWithOverrides({ partnerId: value, projectId: "all" })}
                        />

                        <FilterBarDivider className="hidden xl:block" />

                        <ProjectCombobox
                            projects={projects}
                            currentProject={currentProjectId}
                            onSelect={(value) => pushWithOverrides({ projectId: value, partnerId: "all" })}
                        />

                        <FilterBarDivider className="hidden xl:block" />

                        <TimeRangeCombobox
                            currentTimeRange={currentTimeRange}
                            onSelect={(value) => pushWithOverrides({ timeRange: value })}
                        />
                    </FilterBarGroup>

                    {activeFilters.length > 0 && (
                        <div className="xl:ml-auto">
                            <Link
                                href={clearAllHref}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "text-[12px]" })}
                            >
                                Clear all
                            </Link>
                        </div>
                    )}
                    </FilterBarRow>
                </FilterBarScroll>
            </FilterBarShell>

            <FilterResultsRow className="justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.025)] sm:gap-4 sm:px-4 sm:py-3">
                <p className="ui-text-label">{totalLogs} Results found</p>
                {activeFilters.length > 0 && <span className="text-slate-300">|</span>}
                {activeFilters.map((filter) => (
                    <Link
                        key={filter.key}
                        href={filter.href}
                        className={buttonLinkClassName({ size: "sm", variant: "subtle", className: "h-8 gap-1 text-[12px]" })}
                    >
                        <span>{filter.label}</span>
                        <X className="h-3 w-3 text-slate-400" />
                    </Link>
                ))}
            </FilterResultsRow>
        </div>
    )
}

function PartnerCombobox({
    partners,
    currentPartner,
    onSelect,
}: {
    partners: PaymentsPartnerOption[]
    currentPartner: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentPartner !== "all"
    const selectedPartner = partners.find((p) => p.id === currentPartner)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium tracking-[0.02em] transition-all shadow-none",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <User className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[150px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
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
                                className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
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
                                    className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
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

function ProjectCombobox({
    projects,
    currentProject,
    onSelect,
}: {
    projects: PaymentsProjectOption[]
    currentProject: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentProject !== "all"
    const selectedProject = projects.find((p) => p.id === currentProject)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium tracking-[0.02em] transition-all shadow-none",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Briefcase className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[200px] truncate">{selectedProject ? formatProjectName(selectedProject) : "Project"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
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
                                className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
                            >
                                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                                All projects
                            </CommandItem>
                            {projects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    value={formatProjectName(project)}
                                    onSelect={() => {
                                        onSelect(project.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentProject === project.id ? "opacity-100" : "opacity-0")} />
                                    {formatProjectName(project)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function TimeRangeCombobox({
    currentTimeRange,
    onSelect,
}: {
    currentTimeRange: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentTimeRange !== "all"
    
    const timeRangeLabels: Record<string, string> = {
        "all": "All Time",
        "7d": "Last 7 Days",
        "30d": "Last 30 Days",
        "this_month": "This Month",
        "last_month": "Last Month"
    }
    
    const options = [
        { id: "all", name: "All Time" },
        { id: "7d", name: "Last 7 Days" },
        { id: "30d", name: "Last 30 Days" },
        { id: "this_month", name: "This Month" },
        { id: "last_month", name: "Last Month" },
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium tracking-[0.02em] transition-all shadow-none",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Clock className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[150px] truncate">{timeRangeLabels[currentTimeRange] || "All Time"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[220px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
                    <CommandList>
                        <CommandEmpty>No range found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={option.name}
                                    onSelect={() => {
                                        onSelect(option.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentTimeRange === option.id ? "opacity-100" : "opacity-0")} />
                                    {option.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
