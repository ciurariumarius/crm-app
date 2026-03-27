"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent
} from "@/components/ui/sheet"
import { formatProjectName, formatNumber, formatRelativeDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Trash2,
    Plus,
    Activity,
    Zap,
    RefreshCcw,
    Play
} from "lucide-react"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions/projects"
import { toast } from "sonner"
import { BulkActionsBar } from "@/components/projects/bulk-actions-bar"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { InlineQuickAddRow } from "@/components/projects/inline-quick-add-row"
import { Service, Site } from "@prisma/client"
import type { PartnerWithSites, ProjectWithDetails } from "@/types"
import { sidePanelClass } from "@/lib/ui/side-panels"
import { StatusChip, statusToneFromLabel } from "@/components/ui/status-chip"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SiteWithPartner = Site & { partner?: { id: string; name: string } }

type ProjectTimeLog = {
    durationSeconds?: number | null
}

type ProjectTaskSummary = {
    timeLogs?: ProjectTimeLog[] | null
}

type ProjectTableProject = Omit<ProjectWithDetails, "currentFee"> & {
    currentFee?: number | ProjectWithDetails["currentFee"] | null
    completedTasks?: number
    tasks?: ProjectTaskSummary[]
}

type ProjectUpdatePayload = {
    status?: "Active" | "Paused" | "Completed" | "Closed"
    paymentStatus?: "Paid" | "Unpaid"
    currentFee?: number
    serviceIds?: string[]
    [key: string]: unknown
}

type InlineQuickAddService = {
    id: string
    serviceName: string
    isRecurring: boolean
    baseFee?: number | string | null
}

function toFeeNumber(value: ProjectTableProject["currentFee"]) {
    if (value == null) return 0
    if (typeof value === "number") return value
    if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
        return value.toNumber()
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

interface ProjectTableProps {
    projects: ProjectTableProject[]
    allServices: Service[]
    partners?: PartnerWithSites[]
    layout?: "grid" | "list"
    hourlyRate?: number
}

const LIST_GRID_COLUMNS = "grid-cols-[minmax(320px,3.5fr)_52px_52px_85px_90px_60px_75px_110px_150px]"

export function ProjectsTable({ projects, allServices, partners = [], layout = "grid", hourlyRate = 0 }: ProjectTableProps) {
    const [selectedProject, setSelectedProject] = React.useState<ProjectTableProject | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<SiteWithPartner | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [quickAddOpen, setQuickAddOpen] = React.useState(false)
    const [createProjectDialogOpen, setCreateProjectDialogOpen] = React.useState(false)



    // Derived from projects
    const recurringProjects = projects.filter(p => p.services?.[0]?.isRecurring)
    const oneTimeProjects = projects.filter(p => !p.services?.[0]?.isRecurring)

    const quickAddPartners = React.useMemo(() => {
        if (partners.length > 0) {
            return JSON.parse(JSON.stringify(partners))
        }

        const partnerMap = new Map<string, { id: string; name: string; sites: { id: string; domainName: string }[] }>()

        for (const project of projects) {
            const partnerId = project.site?.partner?.id
            const partnerName = project.site?.partner?.name
            const siteId = project.site?.id
            const domainName = project.site?.domainName

            if (!partnerId || !partnerName) continue

            if (!partnerMap.has(partnerId)) {
                partnerMap.set(partnerId, { id: partnerId, name: partnerName, sites: [] })
            }

            if (siteId && domainName) {
                const currentPartner = partnerMap.get(partnerId)
                if (currentPartner && !currentPartner.sites.some((site) => site.id === siteId)) {
                    currentPartner.sites.push({ id: siteId, domainName })
                }
            }
        }

        return Array.from(partnerMap.values()).sort((left, right) => left.name.localeCompare(right.name))
    }, [partners, projects])

    const quickAddServices = React.useMemo<InlineQuickAddService[]>(
        () =>
            allServices.map((service) => {
                const rawBaseFee = service.baseFee
                let normalizedBaseFee: number | string | null = null

                if (rawBaseFee == null) {
                    normalizedBaseFee = null
                } else if (typeof rawBaseFee === "number" || typeof rawBaseFee === "string") {
                    normalizedBaseFee = rawBaseFee
                } else if (typeof rawBaseFee === "object" && "toNumber" in rawBaseFee && typeof rawBaseFee.toNumber === "function") {
                    normalizedBaseFee = rawBaseFee.toNumber()
                }

                return {
                    id: service.id,
                    serviceName: service.serviceName,
                    isRecurring: service.isRecurring,
                    baseFee: normalizedBaseFee,
                }
            }),
        [allServices]
    )

    const handleUpdate = async (projectId: string, data: ProjectUpdatePayload) => {
        try {
            const result = await updateProject(projectId, data)
            if (result.success) {
                toast.success("Project updated")

                if (selectedProject?.id === projectId) {
                    if (data.serviceIds) {
                        const newServices = allServices.filter((service) => data.serviceIds?.includes(service.id))
                        setSelectedProject((prev) => (prev ? { ...prev, services: newServices } : prev))
                    } else {
                        setSelectedProject((prev) => (prev ? { ...prev, ...data } : prev))
                    }
                }
            } else {
                toast.error(result.error || "Update failed")
            }
        } catch {
            toast.error("Update failed")
        }
    }

    // toggleService moved to ProjectSheetContent

    const renderHeader = () => (
        <div className={cn("glass hidden md:flex h-10 items-center px-6 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground w-full md:min-w-[1280px] gap-5 rounded-lg", layout === "grid" && "hidden")}>
            <div className="flex-1 min-w-[320px] shrink-0">Project name</div>
            <div className="w-[80px] shrink-0 text-center">Status</div>
            <div className="w-[70px] shrink-0 text-center">Type</div>
            <div className="w-[85px] shrink-0 text-center">Payment</div>
            <div className="w-[90px] shrink-0 text-right pr-4">Amount</div>
            <div className="w-[60px] shrink-0 text-center">Tasks</div>
            <div className="w-[75px] shrink-0 text-center">Time</div>
            <div className="w-[100px] shrink-0 truncate">Partner</div>
            <div className="w-[100px] shrink-0 text-right">Last Edited</div>
            <div className="w-[70px] shrink-0 text-right">Created</div>
        </div>
    )

    const renderGridCard = (project: ProjectTableProject, isMonthly: boolean) => {
        const currentFeeValue = toFeeNumber(project.currentFee)
        const normalizedStatus = project.status
        const isClosed = normalizedStatus === "Closed"
        const isPaused = normalizedStatus === "Paused"
        const isCompleted = normalizedStatus === "Completed"
        const isActive = normalizedStatus === "Active"

        const statusColor = isActive
            ? "text-foreground font-bold"
            : isPaused
                ? "text-amber-700"
                : isClosed
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50 line-through"


        return (
            <div
                key={project.id}
                className={cn(
                    "group premium-card relative flex flex-col bg-white rounded-xl p-5 border border-border/60 overflow-hidden",
                    project.paymentStatus === "Unpaid"
                        ? "cockpit-debt-row border-l-[4px] border-l-rose-600"
                        : isMonthly
                            ? "border-l-[4px] border-l-blue-600"
                            : "border-l-[4px] border-l-emerald-500"
                )}
                onClick={() => setSelectedProject(project)}
            >
                {/* 1. Top Section: Project Name */}
                <div className="flex justify-between items-start mb-3">
                    <span className={cn("text-xl md:text-2xl font-bold leading-tight tracking-tight break-words text-wrap line-clamp-2", statusColor)}>
                        {formatProjectName(project)}
                    </span>
                </div>

                {/* 2. Badges & Amount Row */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-3 gap-x-2 mb-4">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* Status Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {isActive ? (
                                        <StatusChip tone="active" size="icon" icon={<Play className="h-4 w-4 fill-current ml-0.5" />} />
                                    ) : (
                                        <StatusChip tone={statusToneFromLabel(normalizedStatus)} size="sm">
                                            {normalizedStatus}
                                        </StatusChip>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-xs font-semibold text-blue-600 p-2 cursor-pointer">Active</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-xs font-semibold text-amber-600 p-2 cursor-pointer">Paused</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-xs font-semibold text-emerald-600 p-2 cursor-pointer">Completed</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Closed" })} className="text-xs font-semibold text-slate-700 p-2 cursor-pointer">Closed</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>


                        {/* Payment Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                                    <StatusChip tone={project.paymentStatus === "Paid" ? "paid" : "unpaid"} size="sm">
                                        {project.paymentStatus}
                                    </StatusChip>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-xs font-semibold text-emerald-600 p-2 cursor-pointer">Paid</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-xs font-semibold text-rose-600 p-2 cursor-pointer">Unpaid</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>


                        {/* Type Pill */}
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                             <StatusChip tone={isMonthly ? "recurring" : "oneTime"} size="sm">
                                 {isMonthly ? "Recurring" : "One-Time"}
                             </StatusChip>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                            type="number"
                            defaultValue={currentFeeValue}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== currentFeeValue) {
                                    handleUpdate(project.id, { currentFee: val })
                                }
                            }}
                            className="h-auto p-0 border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 text-lg sm:text-xl font-semibold text-right w-16 shadow-none -mb-0.5"
                        />
                        <span className="text-xs font-medium text-muted-foreground/60 font-mono">RON</span>
                    </div>
                </div>


            </div>
        )
    }

    const renderProjectCard = (project: ProjectTableProject, rowIndex: number) => {
        const currentFeeValue = toFeeNumber(project.currentFee)
        const normalizedStatus = project.status
        const isClosed = normalizedStatus === "Closed"
        const isPaused = normalizedStatus === "Paused"
        const isCompleted = normalizedStatus === "Completed"
        const isActive = normalizedStatus === "Active"

        const statusColor = isActive
            ? "text-foreground font-bold"
            : isPaused
                ? "text-amber-700"
                : isClosed
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50 line-through"

        const isMonthly = project.services?.[0]?.isRecurring

        return (
            <div
                key={project.id}
                className={cn(
                    "group stagger-row-enter premium-card relative flex min-h-[52px] items-center bg-white rounded-xl p-4 border border-border/60 w-full cursor-pointer overflow-x-auto md:min-w-[1280px] gap-5 px-6",
                    project.paymentStatus === "Unpaid" ? "cockpit-debt-row" : "hover:bg-[#F1F5F9]"
                )}
                style={{ animationDelay: `${rowIndex * 0.05}s` }}
                onClick={() => setSelectedProject(project)}
            >
                {/* 1. Project Name & URL */}
                <div className="flex-1 min-w-[320px] shrink-0 flex items-center">
                    <div className="flex flex-col pr-4">
                        <span className={cn("text-base md:text-lg font-semibold tracking-tight line-clamp-2", statusColor)}>
                            {formatProjectName(project)}
                        </span>
                    </div>
                </div>

                {/* 2. Status Pill */}
                <div className="w-[80px] shrink-0 flex justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {isActive ? (
                                    <StatusChip tone="active" size="icon" icon={<Play className="h-4 w-4 fill-current ml-0.5" />} />
                                ) : (
                                    <StatusChip tone={statusToneFromLabel(normalizedStatus)} size="sm" className="min-w-[70px] justify-center">
                                        {normalizedStatus.substring(0, 12)}
                                    </StatusChip>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-xs font-semibold text-blue-600 p-2 cursor-pointer">Active</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-xs font-semibold text-amber-600 p-2 cursor-pointer">Paused</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-xs font-semibold text-emerald-600 p-2 cursor-pointer">Completed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Closed" })} className="text-xs font-semibold text-slate-700 p-2 cursor-pointer">Closed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 3. Type Pill */}
                <div className="w-[70px] shrink-0 flex items-center justify-center">
                    <StatusChip tone={isMonthly ? "recurring" : "oneTime"} size="sm" className="w-full justify-center">
                        {isMonthly ? "Monthly" : "One-Time"}
                    </StatusChip>
                </div>

                {/* 4. Payment */}
                <div className="w-[85px] shrink-0 flex items-center justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <StatusChip tone={project.paymentStatus === "Paid" ? "paid" : "unpaid"} size="sm" className="min-w-[75px] justify-center">
                                    {project.paymentStatus}
                                </StatusChip>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-xs font-semibold text-emerald-600 p-2 cursor-pointer">Paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-xs font-semibold text-rose-600 p-2 cursor-pointer">Unpaid</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 5. Amount */}
                <div className="w-[90px] shrink-0 flex items-center justify-end">
                    <div className="relative group/fee flex items-baseline">
                        <Input
                            type="number"
                            defaultValue={currentFeeValue}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== currentFeeValue) {
                                    handleUpdate(project.id, { currentFee: val })
                                }
                            }}
                            className="h-10 text-base md:text-lg font-semibold bg-transparent border-transparent hover:bg-muted/50 focus:bg-muted/50 focus:ring-0 p-0 w-16 text-right cursor-text rounded transition-colors shadow-none -mb-0.5"
                        />
                        <span className="text-xs text-muted-foreground/60 ml-0.5 font-mono font-medium mt-0.5">RON</span>
                    </div>
                </div>

                {/* 6. Tasks Pi */}
                <div className="w-[60px] shrink-0 flex items-center justify-center">
                    {(() => {
                        const totalTasks = project._count?.tasks || 0
                        const completedTasks = project.completedTasks || 0
                        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
                        return (
                            <div className="relative h-8 w-8">
                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                    <circle className="stroke-slate-100 dark:stroke-zinc-800" strokeWidth="3" fill="transparent" r="16" cx="18" cy="18" />
                                    <circle
                                        className={cn("transition-all duration-500", isMonthly ? "stroke-blue-600" : "stroke-emerald-600")}
                                        strokeWidth="3"
                                        strokeDasharray={`${progress}, 100`}
                                        strokeLinecap="round"
                                        fill="transparent"
                                        r="16"
                                        cx="18"
                                        cy="18"
                                        transform="rotate(-90 18 18)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{completedTasks}/{totalTasks}</span>
                                </div>
                            </div>
                        )
                    })()}
                </div>

                {/* 7. Time Tracking */}
                <div className="w-[75px] shrink-0 flex items-center justify-center">
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center font-mono text-[11px] font-semibold tracking-[0.01em] text-slate-600 tabular-nums">
                        {(() => {
                            const totalSeconds = project.tasks?.reduce((acc: number, task: ProjectTaskSummary) => {
                                const taskLogs = task.timeLogs?.reduce((lAcc: number, log: ProjectTimeLog) => lAcc + (log.durationSeconds || 0), 0) || 0
                                return acc + taskLogs
                            }, 0) || 0
                            const h = Math.floor(totalSeconds / 3600)
                            const m = Math.floor((totalSeconds % 3600) / 60)
                            return `${h}h ${m}m`
                        })()}
                    </span>
                </div>

                {/* 8. Partner Name */}
                <div className="w-[100px] shrink-0 flex items-center">
                    <span className="text-sm font-medium text-foreground truncate leading-snug" title={project.site?.partner?.name || "No Partner"}>
                        {project.site?.partner?.name || "-"}
                    </span>
                </div>

                {/* 9. Last Edited */}
                <div className="w-[100px] shrink-0 flex items-center justify-end">
                    <span className="text-[11px] text-muted-foreground font-medium text-right font-mono tabular-nums">
                        {project.updatedAt ? formatRelativeDate(project.updatedAt) : "-"}
                    </span>
                </div>

                {/* 10. Created */}
                <div className="w-[70px] shrink-0 flex items-center justify-end">
                    <span className="text-[11px] text-muted-foreground/60 font-medium text-right font-mono tabular-nums">
                        {project.createdAt ? formatRelativeDate(project.createdAt) : "-"}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-border/40 text-muted-foreground hover:text-rose-500 hover:border-rose-200 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-12">
            {/* One-Time Group */}
            {oneTimeProjects.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1.5 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none">One-Time Projects</span>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground hidden md:block">
                            Subtotal: <span className="text-foreground">{formatNumber(oneTimeProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0))} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {oneTimeProjects.map(p => renderGridCard(p, false))}
                            {/* Shadow Card */}
                            <div
                                className="group/shadow bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-white border border-dashed border-primary/30 rounded-xl flex flex-col justify-center items-center h-[180px] transition-all cursor-pointer"
                                onClick={() => setCreateProjectDialogOpen(true)}
                            >
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/shadow:scale-110 group-hover/shadow:bg-primary/20 transition-all">
                                    <Plus className="h-6 w-6" strokeWidth={3} />
                                </div>
                                <span className="mt-3 text-xs font-semibold text-primary transition-colors">Start New Project</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {oneTimeProjects.map(p => renderGridCard(p, false))}
                            </div>
                            <div className="hidden md:block overflow-x-auto pb-4 hidescrollbar text-slate-900">
                                <div className="md:min-w-[1240px] flex flex-col gap-2">
                                    {renderHeader()}
                                    {oneTimeProjects.map((project, index) => renderProjectCard(project, index))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Monthly Group */}
            {recurringProjects.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1.5 rounded-full bg-blue-500 shadow-sm" />
                            <span className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none">Monthly Projects</span>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground hidden md:block">
                            Subtotal: <span className="text-foreground">{formatNumber(recurringProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0))} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {recurringProjects.map(p => renderGridCard(p, true))}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {recurringProjects.map(p => renderGridCard(p, true))}
                            </div>
                            <div className="hidden md:block overflow-x-auto pb-4 hidescrollbar text-slate-900">
                                <div className="md:min-w-[1280px] flex flex-col gap-2">
                                    {renderHeader()}
                                    {recurringProjects.map((project, index) => renderProjectCard(project, index))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {layout === "list" && (
                <div className="pt-2 overflow-x-auto pb-24 hidescrollbar text-slate-900">
                    <div className="md:min-w-[1280px]">
                        {quickAddOpen ? (
                            <InlineQuickAddRow
                                partners={quickAddPartners}
                                services={quickAddServices}
                                onCancel={() => setQuickAddOpen(false)}
                                gridColumns={LIST_GRID_COLUMNS}
                                autoFocus
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setQuickAddOpen(true)}
                                className={cn("w-full text-left grid gap-5 items-center rounded-xl border border-dashed border-primary/30 bg-primary/5 px-6 py-4 transition-all hover:bg-primary/10 group/shadow", LIST_GRID_COLUMNS)}
                            >
                                <div className="min-w-0 flex items-center gap-4">
                                    <div className="h-6 w-16 bg-primary/10 rounded-full animate-pulse flex-shrink-0" />
                                    <div className="flex items-center gap-2">
                                        <Plus className="h-4 w-4 text-primary group-hover/shadow:scale-110 transition-transform" />
                                        <span className="text-sm font-semibold text-primary">Add new project...</span>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Create Project Dialog */}
            <GlobalCreateProjectDialog
                open={createProjectDialogOpen}
                onOpenChange={setCreateProjectDialogOpen}
                partners={JSON.parse(JSON.stringify(quickAddPartners))}
                services={allServices}
            />

            {/* Comprehensive Project Detail Drawer */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => {
                if (!open) {
                    setSelectedProject(null)
                }
            }}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("default")}>
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject as ProjectWithDetails}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onUpdate={(updated) => setSelectedProject((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onOpenSite={(site) => setSelectedSite(site)}
                            onClose={() => setSelectedProject(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site Detail Sheet */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow")}>
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                setSelectedSite({ ...selectedSite, ...updated })
                            }}
                            onClose={() => setSelectedSite(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            <BulkActionsBar
                selectedIds={selectedIds}
                onClearSelection={() => setSelectedIds([])}
                totalProjects={projects.length}
            />

        </div>
    )
}
