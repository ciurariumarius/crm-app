"use client"

import * as React from "react"
import { format } from "date-fns"
import { ArrowDownUp, CalendarDays, Check, Circle, Pause, Play, Plus, Repeat2, Square, RefreshCcw, Zap, Wallet, Timer, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"
import { InlineQuickAddRow } from "@/components/projects/inline-quick-add-row"
import { normalizeProjectStatus } from "@/lib/status"
import { updateProject } from "@/lib/actions/projects"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const currencyFormatter = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

function formatDuration(totalSeconds: number) {
    if (totalSeconds <= 0) return "0h 0m"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
}

const LIST_GRID_COLUMNS = "grid-cols-[minmax(320px,3.5fr)_72px_90px_78px_95px_60px_78px_96px_116px_116px]"

function toTimestamp(value: Date | string | null | undefined) {
    if (!value) return null
    const date = new Date(value)
    const timestamp = date.getTime()
    return Number.isNaN(timestamp) ? null : timestamp
}

function formatDateTimeParts(value: Date | string | null | undefined) {
    if (!value) return { dateLabel: "—", timeLabel: "—" }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return { dateLabel: "—", timeLabel: "—" }
    return {
        dateLabel: format(date, "dd/MM/yy"),
        timeLabel: format(date, "HH:mm"),
    }
}

function DateTimeCell({ value }: { value: Date | string | null | undefined }) {
    const { dateLabel, timeLabel } = formatDateTimeParts(value)
    return (
        <div className="flex items-center justify-start gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="flex flex-col items-start leading-tight">
                <span className="text-[11px] font-medium text-slate-500">{dateLabel}</span>
                <span className="text-[10px] font-medium text-slate-400">{timeLabel}</span>
            </span>
        </div>
    )
}

function getStatusBadge(status: string) {
    if (status === "Active") {
        return {
            label: "Active",
            className: "status-pill status-pill-action",
            icon: <Play className="h-3 w-3 fill-current" />,
        }
    }

    if (status === "Closed") {
        return {
            label: "Closed",
            className: "status-pill status-pill-closed",
            icon: <Square className="h-3 w-3 fill-current" />,
        }
    }

    if (status === "Paused") {
        return {
            label: "Paused",
            className: "status-pill status-pill-warning",
            icon: <Pause className="h-3 w-3" />,
        }
    }

    if (status === "Completed") {
        return {
            label: "Completed",
            className: "status-pill status-pill-success",
            icon: <Check className="h-3.5 w-3.5" />,
        }
    }

    return {
        label: status,
        className: "status-pill",
        icon: <Circle className="h-3 w-3" />,
    }
}

type BoardPartner = {
    id: string
    name: string
    sites?: { id: string; domainName: string }[]
}

type BoardService = {
    id: string
    serviceName: string
    isRecurring: boolean
    baseFee?: number | string | null
}

type BoardProject = {
    id: string
    name?: string | null
    status: string
    paymentStatus: string
    amount: number
    secondsLogged: number
    completedTasks: number
    createdAt: string | Date
    updatedAt: string | Date
    isRecurring: boolean
    serviceLabel: string
    site: {
        domainName: string
        partner: {
            name: string
        }
    }
    _count?: {
        tasks?: number
    }
    tasks?: unknown[]
}

type TotalsSummary = {
    count: number
    totalAmount: number
    totalSeconds: number
}

type BoardSortBy = "createdAt" | "updatedAt" | "amount" | "name" | "time"
type BoardSortDirection = "asc" | "desc"

export function ProjectsBoardRows({
    projects,
    layout,
    partners = [],
    services = [],
    hourlyRate = 0,
    initialSortBy = "updatedAt",
    initialSortDirection = "desc",
}: {
    projects: BoardProject[]
    layout: "grid" | "list"
    partners?: BoardPartner[]
    services?: BoardService[]
    hourlyRate?: number
    initialSortBy?: BoardSortBy
    initialSortDirection?: BoardSortDirection
}) {
    const { openProject } = React.useContext(ProjectSheetContext)
    const [sortBy, setSortBy] = React.useState<BoardSortBy>(initialSortBy)
    const [sortDirection, setSortDirection] = React.useState<BoardSortDirection>(initialSortDirection)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [inlineEdits, setInlineEdits] = React.useState<Record<string, { status?: string; paymentStatus?: string; amount?: number }>>({})
    const [amountEditorProjectId, setAmountEditorProjectId] = React.useState<string | null>(null)
    const [amountDraft, setAmountDraft] = React.useState("")

    React.useEffect(() => {
        setSortBy(initialSortBy)
        setSortDirection(initialSortDirection)
    }, [initialSortBy, initialSortDirection])

    const setSort = (key: BoardSortBy) => {
        if (sortBy === key) {
            setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
            return
        }

        setSortBy(key)
        setSortDirection(key === "name" ? "asc" : "desc")
    }

    const sortProjects = React.useCallback(
        (items: BoardProject[]) =>
            [...items].sort((a, b) => {
                let leftValue: number | string | null
                let rightValue: number | string | null

                if (sortBy === "name") {
                    leftValue = (a.site?.domainName || a.name || "").toLowerCase()
                    rightValue = (b.site?.domainName || b.name || "").toLowerCase()
                } else if (sortBy === "amount") {
                    leftValue = Number(a.amount || 0)
                    rightValue = Number(b.amount || 0)
                } else if (sortBy === "time") {
                    leftValue = Number(a.secondsLogged || 0)
                    rightValue = Number(b.secondsLogged || 0)
                } else if (sortBy === "updatedAt") {
                    leftValue = toTimestamp(a.updatedAt)
                    rightValue = toTimestamp(b.updatedAt)
                } else {
                    leftValue = toTimestamp(a.createdAt)
                    rightValue = toTimestamp(b.createdAt)
                }

                if (leftValue === null && rightValue === null) return 0
                if (leftValue === null) return 1
                if (rightValue === null) return -1

                if (leftValue < rightValue) return sortDirection === "desc" ? 1 : -1
                if (leftValue > rightValue) return sortDirection === "desc" ? -1 : 1
                return 0
            }),
        [sortBy, sortDirection]
    )

    const monthlyProjects = sortProjects(projects.filter((project) => project.isRecurring))
    const oneTimeProjects = sortProjects(projects.filter((project) => !project.isRecurring))
    const orderedProjects = [...oneTimeProjects, ...monthlyProjects]

    const totals = React.useMemo(() => {
        return projects.reduce<TotalsSummary>(
            (acc, project) => {
                acc.count += 1
                acc.totalAmount += Number(inlineEdits[project.id]?.amount ?? project.amount ?? 0)
                acc.totalSeconds += Number(project.secondsLogged || 0)
                return acc
            },
            { count: 0, totalAmount: 0, totalSeconds: 0 }
        )
    }, [projects, inlineEdits])

    const oneTimeCount = oneTimeProjects.length
    const monthlyCount = monthlyProjects.length

    const openDetails = (projectId: string) => {
        openProject(projectId)
    }

    const getDisplayStatus = (project: BoardProject) =>
        normalizeProjectStatus(inlineEdits[project.id]?.status ?? project.status)

    const getDisplayPayment = (project: BoardProject) =>
        inlineEdits[project.id]?.paymentStatus ?? project.paymentStatus

    const getDisplayAmount = (project: BoardProject) =>
        Number(inlineEdits[project.id]?.amount ?? project.amount ?? 0)

    const getAllocatedSeconds = (project: BoardProject) => {
        const rate = Number(hourlyRate || 0)
        if (rate <= 0) return null
        const amount = getDisplayAmount(project)
        if (amount <= 0) return null
        return (amount / rate) * 3600
    }

    const isTimeOverAllocated = (project: BoardProject) => {
        const allocatedSeconds = getAllocatedSeconds(project)
        if (!allocatedSeconds) return false
        return Number(project.secondsLogged || 0) > allocatedSeconds
    }

    const getProjectToneClass = (status: string) => {
        if (status === "Paused") return "project-state-paused"
        if (status === "Completed") return "project-state-completed"
        if (status === "Closed") return "project-state-closed"
        return "project-state-active"
    }

    const getProjectTitleClass = (status: string) => {
        if (status === "Completed") return "text-slate-800"
        if (status === "Closed") return "text-slate-500"
        return "text-slate-900"
    }

    const getProjectMetaClass = (status: string) => {
        if (status === "Closed") return "text-slate-400"
        if (status === "Completed") return "text-slate-500"
        return "text-slate-500"
    }

    const setProjectStatus = async (project: BoardProject, nextStatus: "Active" | "Paused" | "Completed" | "Closed") => {
        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: { ...prev[project.id], status: nextStatus },
        }))

        const result = await updateProject(project.id, { status: nextStatus })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: { ...prev[project.id], status: project.status },
            }))
            toast.error(result.error || "Failed to update status")
        }
    }

    const setProjectPayment = async (project: BoardProject, nextPayment: "Paid" | "Unpaid") => {
        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: { ...prev[project.id], paymentStatus: nextPayment },
        }))

        const result = await updateProject(project.id, { paymentStatus: nextPayment })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: { ...prev[project.id], paymentStatus: project.paymentStatus },
            }))
            toast.error(result.error || "Failed to update payment status")
        }
    }

    const openAmountEditor = (project: BoardProject) => {
        setAmountEditorProjectId(project.id)
        setAmountDraft(String(getDisplayAmount(project)))
    }

    const saveProjectAmount = async (project: BoardProject) => {
        const normalized = amountDraft.trim().replace(",", ".")
        const parsed = Number(normalized)

        if (!normalized.length || Number.isNaN(parsed) || parsed < 0) {
            toast.error("Enter a valid amount")
            return
        }

        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: { ...prev[project.id], amount: parsed },
        }))
        setAmountEditorProjectId(null)

        const result = await updateProject(project.id, { currentFee: parsed })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: { ...prev[project.id], amount: project.amount },
            }))
            toast.error(result.error || "Failed to update amount")
        }
    }

    if (layout === "grid") {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orderedProjects.map((project) => {
                    const projectStatus = normalizeProjectStatus(project.status)
                    const overAllocated = isTimeOverAllocated(project)
                    const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                    const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                    const statusBadge = getStatusBadge(projectStatus)
                    return (
                        <button
                            key={project.id}
                            type="button"
                            onClick={() => openDetails(project.id)}
                            className={cn("text-left rounded-xl border border-border/60 bg-card p-5 premium-card", getProjectToneClass(projectStatus))}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className={cn("text-lg font-bold tracking-tight truncate", getProjectTitleClass(projectStatus))}>{project.site.domainName}</p>
                                    <div className={cn("mt-1 flex items-center gap-2 text-sm", getProjectMetaClass(projectStatus))}>
                                        <p className="truncate">{project.serviceLabel}</p>
                                        {projectStatus !== "Active" && (
                                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusBadge.className)}>
                                                {statusBadge.icon}
                                                {statusBadge.label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={cn(
                                    "status-pill",
                                    projectStatus === "Active" ? "status-pill-action" :
                                        projectStatus === "Paused" ? "status-pill-warning" :
                                        projectStatus === "Completed" ? "status-pill-success" :
                                            "status-pill-closed"
                                )}>
                                    {projectStatus}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Type</p>
                                    <p className="font-medium text-slate-700">{project.isRecurring ? "Monthly" : "One-time"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Payment</p>
                                    <p className={cn("font-medium", project.paymentStatus === "Paid" ? "text-emerald-700" : "text-rose-600")}>{project.paymentStatus}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Amount</p>
                                    <p className="font-semibold text-slate-800">{currencyFormatter.format(project.amount)} RON</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Time</p>
                                    <p
                                        className={cn(
                                            "font-semibold",
                                            overAllocated
                                                ? "inline-flex items-center rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 text-rose-800 shadow-sm"
                                                : "text-slate-700"
                                        )}
                                    >
                                        {formatDuration(project.secondsLogged)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
                                    <span>Tasks</span>
                                    <span>{project.completedTasks}/{totalTasks}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-7 overflow-x-auto pb-24 hidescrollbar">
            <div className="md:min-w-[1280px] space-y-7">
                <section className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="h-5 w-1 rounded-full bg-emerald-500" />
                        <h2 className="text-lg font-semibold tracking-tight text-slate-900">One-time Projects</h2>
                    </div>

                    <div className={cn("hidden md:grid items-center px-6 text-[11px] text-slate-500 font-bold uppercase tracking-wider gap-x-2", LIST_GRID_COLUMNS)}>
                        <button
                            type="button"
                            onClick={() => setSort("name")}
                            className={cn(
                                "inline-flex items-center gap-1 text-left text-[11px] font-bold uppercase tracking-wider",
                                sortBy === "name" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                            )}
                            title={`Sort by name (${sortBy === "name" ? (sortDirection === "desc" ? "Z-A" : "A-Z") : "A-Z"})`}
                        >
                            Project name
                            <ArrowDownUp className="h-3 w-3" />
                        </button>
                        <span className="text-center">Status</span>
                        <span className="text-center">Payment</span>
                        <span className="text-center">Type</span>
                        <button
                            type="button"
                            onClick={() => setSort("amount")}
                            className={cn(
                                "inline-flex items-center justify-end gap-1 text-right text-[11px] font-bold uppercase tracking-wider",
                                sortBy === "amount" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                            )}
                            title={`Sort by amount (${sortBy === "amount" && sortDirection === "desc" ? "high to low" : "low to high"})`}
                        >
                            Amount
                            <ArrowDownUp className="h-3 w-3" />
                        </button>
                        <span className="text-center">Tasks</span>
                        <button
                            type="button"
                            onClick={() => setSort("time")}
                            className={cn(
                                "inline-flex items-center justify-center gap-1 text-center text-[11px] font-bold uppercase tracking-wider",
                                sortBy === "time" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                            )}
                            title={`Sort by time (${sortBy === "time" && sortDirection === "desc" ? "most to least" : "least to most"})`}
                        >
                            Time
                            <ArrowDownUp className="h-3 w-3" />
                        </button>
                        <span>Partner</span>
                        <button
                            type="button"
                            onClick={() => setSort("updatedAt")}
                            className={cn(
                                "inline-flex items-center justify-end gap-1 text-right text-[11px] font-bold uppercase tracking-wider",
                                sortBy === "updatedAt" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                            )}
                            title={`Sort by last edit (${sortBy === "updatedAt" && sortDirection === "desc" ? "newest first" : "oldest first"})`}
                        >
                            Last Edit
                            <ArrowDownUp className="h-3 w-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSort("createdAt")}
                            className={cn(
                                "inline-flex items-center justify-end gap-1 text-right text-[11px] font-bold uppercase tracking-wider",
                                sortBy === "createdAt" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                            )}
                            title={`Sort by created date (${sortBy === "createdAt" && sortDirection === "desc" ? "newest first" : "oldest first"})`}
                        >
                            Created
                            <ArrowDownUp className="h-3 w-3" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {oneTimeProjects.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-slate-500">
                                No one-time projects match current filters.
                            </div>
                        )}
                        {oneTimeProjects.map((project) => {
                            const projectStatus = getDisplayStatus(project)
                            const projectPayment = getDisplayPayment(project)
                            const overAllocated = isTimeOverAllocated(project)
                            const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                            const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                            const statusBadge = getStatusBadge(projectStatus)
                            return (
                                <React.Fragment key={project.id}>
                                    <button
                                        type="button"
                                        onClick={() => openDetails(project.id)}
                                        className={cn("w-full rounded-xl border border-border/60 bg-card px-4 py-3 text-left premium-card md:hidden", getProjectToneClass(projectStatus))}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 pr-2">
                                                <p className={cn("break-words font-bold leading-tight tracking-tight", getProjectTitleClass(projectStatus))}>{project.site.domainName}</p>
                                                <div className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-sm", getProjectMetaClass(projectStatus))}>
                                                    <span className="break-words">{project.serviceLabel}</span>
                                                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-emerald-600">
                                                        {format(new Date(project.createdAt), "MMM yyyy")}
                                                    </span>
                                                    {projectStatus !== "Active" && (
                                                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusBadge.className)}>
                                                            {statusBadge.icon}
                                                            {statusBadge.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={cn(
                                                "status-pill min-w-[72px] justify-center",
                                                project.paymentStatus === "Paid" ? "status-pill-success" : "status-pill-debt"
                                            )}>
                                                {project.paymentStatus}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-base font-bold text-slate-900">
                                                {currencyFormatter.format(project.amount)} <span className="text-[10px] text-slate-400">RON</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    title={statusBadge.label}
                                                    aria-label={statusBadge.label}
                                                    className={cn(
                                                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all",
                                                        statusBadge.className
                                                    )}
                                                >
                                                    {statusBadge.icon}
                                                </span>
                                                <span
                                                    title="One-time"
                                                    aria-label="One-time"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-all"
                                                >
                                                    <Zap className="h-4 w-4 [stroke-width:1.5]" />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openDetails(project.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                openDetails(project.id)
                                            }
                                        }}
                                        className={cn("hidden w-full text-left md:grid gap-x-2 items-center rounded-xl border border-border/60 bg-card px-6 py-2.5 premium-card", LIST_GRID_COLUMNS, getProjectToneClass(projectStatus))}
                                    >
                                        <div className="min-w-0">
                                            <p className={cn("font-bold tracking-tight whitespace-nowrap overflow-x-auto hidescrollbar", getProjectTitleClass(projectStatus))}>{project.site.domainName}</p>
                                            <div className={cn("flex items-center gap-2 text-sm min-w-0", getProjectMetaClass(projectStatus))}>
                                                <span className="whitespace-nowrap overflow-x-auto hidescrollbar">{project.serviceLabel}</span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 uppercase tracking-tighter">
                                                    {format(new Date(project.createdAt), "MMM yyyy")}
                                                </span>
                                                {projectStatus !== "Active" && (
                                                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusBadge.className)}>
                                                        {statusBadge.icon}
                                                        {statusBadge.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        title={`Status: ${statusBadge.label}`}
                                                        aria-label={`Status: ${statusBadge.label}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className={cn(
                                                            "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all",
                                                            projectStatus === "Active" && "border-blue-300 bg-blue-100 text-blue-700",
                                                            projectStatus === "Paused" && "border-amber-300 bg-amber-100 text-amber-700",
                                                            projectStatus === "Completed" && "border-emerald-300 bg-emerald-100 text-emerald-700",
                                                            projectStatus === "Closed" && "border-slate-300 bg-slate-200 text-slate-700",
                                                        )}
                                                    >
                                                        {statusBadge.icon}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                                    {(["Active", "Paused", "Completed", "Closed"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={() => void setProjectStatus(project, option)}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Active" && "bg-blue-500",
                                                                option === "Paused" && "bg-amber-500",
                                                                option === "Completed" && "bg-emerald-500",
                                                                option === "Closed" && "bg-slate-500"
                                                            )} />
                                                            {option}
                                                            {projectStatus === option && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        className={cn(
                                                            "status-pill h-9 min-w-[84px] justify-center transition-all rounded-xl",
                                                            projectPayment === "Paid" ? "status-pill-success" : "status-pill-debt"
                                                        )}
                                                        title={`Payment: ${projectPayment}`}
                                                    >
                                                        {projectPayment}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                                    {(["Paid", "Unpaid"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={() => void setProjectPayment(project, option)}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                                            )} />
                                                            {option}
                                                            {projectPayment === option && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                title="One-time"
                                                aria-label="One-time"
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-all"
                                            >
                                                <Zap className="h-4 w-4 [stroke-width:1.5]" />
                                            </span>
                                        </div>
                                        <div className="flex justify-end">
                                            <Popover
                                                open={amountEditorProjectId === project.id}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(project)
                                                    else setAmountEditorProjectId(null)
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            openAmountEditor(project)
                                                        }}
                                                        className="font-bold text-slate-800 text-right transition-colors hover:text-blue-700"
                                                        title="Edit amount"
                                                    >
                                                        {currencyFormatter.format(getDisplayAmount(project))} <span className="text-slate-400 text-[9px]">RON</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    align="end"
                                                    className="w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Amount (RON)</p>
                                                        <input
                                                            value={amountDraft}
                                                            onChange={(event) => setAmountDraft(event.target.value)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault()
                                                                    void saveProjectAmount(project)
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setAmountEditorProjectId(null)
                                                                }
                                                            }}
                                                            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                            autoFocus
                                                        />
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                                                                onClick={() => setAmountEditorProjectId(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                                                onClick={() => void saveProjectAmount(project)}
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="relative h-8 w-8">
                                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                                    <circle className="stroke-slate-100 dark:stroke-zinc-800" strokeWidth="3" fill="transparent" r="16" cx="18" cy="18" />
                                                    <circle
                                                        className="stroke-emerald-600 transition-all duration-500"
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
                                                    <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{project.completedTasks}/{totalTasks}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                className={cn(
                                                    "px-2 py-1 rounded-lg text-[10px] font-bold text-center uppercase tracking-tight min-w-[50px] border",
                                                    overAllocated
                                                        ? "text-rose-800 bg-rose-100 border-rose-300 ring-1 ring-rose-200 shadow-sm font-black"
                                                        : "text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                                                )}
                                            >
                                                {formatDuration(project.secondsLogged)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 truncate block">{project.site.partner.name}</span>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.updatedAt} />
                                        </div>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.createdAt} />
                                        </div>
                                    </div>
                                </React.Fragment>
                            )
                        })}


                    </div>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="h-5 w-1 rounded-full bg-violet-500" />
                        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Monthly Projects</h2>
                    </div>

                    <div className="space-y-2">
                        {monthlyProjects.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-slate-500">
                                No monthly projects match current filters.
                            </div>
                        )}
                        {monthlyProjects.map((project) => {
                            const projectStatus = getDisplayStatus(project)
                            const projectPayment = getDisplayPayment(project)
                            const overAllocated = isTimeOverAllocated(project)
                            const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                            const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                            const statusBadge = getStatusBadge(projectStatus)
                            return (
                                <React.Fragment key={project.id}>
                                    <button
                                        type="button"
                                        onClick={() => openDetails(project.id)}
                                        className={cn("w-full rounded-xl border border-border/60 bg-card px-4 py-3 text-left premium-card md:hidden", getProjectToneClass(projectStatus))}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 pr-2">
                                                <p className={cn("break-words font-bold leading-tight tracking-tight", getProjectTitleClass(projectStatus))}>{project.site.domainName}</p>
                                                <div className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-sm", getProjectMetaClass(projectStatus))}>
                                                    <span className="break-words">{project.serviceLabel}</span>
                                                    <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-600">
                                                        {format(new Date(project.createdAt), "MMM yyyy")}
                                                    </span>
                                                    {projectStatus !== "Active" && (
                                                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusBadge.className)}>
                                                            {statusBadge.icon}
                                                            {statusBadge.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={cn(
                                                "status-pill min-w-[72px] justify-center",
                                                project.paymentStatus === "Paid" ? "status-pill-success" : "status-pill-debt"
                                            )}>
                                                {project.paymentStatus}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-base font-bold text-slate-900">
                                                {currencyFormatter.format(project.amount)} <span className="text-[10px] text-slate-400">RON</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    title={statusBadge.label}
                                                    aria-label={statusBadge.label}
                                                    className={cn(
                                                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all",
                                                        statusBadge.className
                                                    )}
                                                >
                                                    {statusBadge.icon}
                                                </span>
                                                <span
                                                    title="Monthly"
                                                    aria-label="Monthly"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition-all"
                                                >
                                                    <RefreshCcw className="h-4 w-4 [stroke-width:1.5]" />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openDetails(project.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                openDetails(project.id)
                                            }
                                        }}
                                        className={cn("hidden w-full text-left md:grid gap-x-2 items-center rounded-xl border border-border/60 bg-card px-6 py-2.5 premium-card", LIST_GRID_COLUMNS, getProjectToneClass(projectStatus))}
                                    >
                                        <div className="min-w-0">
                                            <p className={cn("font-bold tracking-tight whitespace-nowrap overflow-x-auto hidescrollbar", getProjectTitleClass(projectStatus))}>{project.site.domainName}</p>
                                            <div className={cn("flex items-center gap-2 text-sm min-w-0", getProjectMetaClass(projectStatus))}>
                                                <span className="whitespace-nowrap overflow-x-auto hidescrollbar">{project.serviceLabel}</span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 shrink-0 uppercase tracking-tighter">
                                                    {format(new Date(project.createdAt), "MMM yyyy")}
                                                </span>
                                                {projectStatus !== "Active" && (
                                                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusBadge.className)}>
                                                        {statusBadge.icon}
                                                        {statusBadge.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        title={`Status: ${statusBadge.label}`}
                                                        aria-label={`Status: ${statusBadge.label}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                        className={cn(
                                                            "inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all",
                                                            projectStatus === "Active" && "border-blue-300 bg-blue-100 text-blue-700",
                                                            projectStatus === "Paused" && "border-amber-300 bg-amber-100 text-amber-700",
                                                            projectStatus === "Completed" && "border-emerald-300 bg-emerald-100 text-emerald-700",
                                                            projectStatus === "Closed" && "border-slate-300 bg-slate-200 text-slate-700",
                                                        )}
                                                    >
                                                        {statusBadge.icon}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                                    {(["Active", "Paused", "Completed", "Closed"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={() => void setProjectStatus(project, option)}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Active" && "bg-blue-500",
                                                                option === "Paused" && "bg-amber-500",
                                                                option === "Completed" && "bg-emerald-500",
                                                                option === "Closed" && "bg-slate-500"
                                                            )} />
                                                            {option}
                                                            {projectStatus === option && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        className={cn(
                                                            "status-pill h-9 min-w-[84px] justify-center transition-all rounded-xl",
                                                            projectPayment === "Paid" ? "status-pill-success" : "status-pill-debt"
                                                        )}
                                                        title={`Payment: ${projectPayment}`}
                                                    >
                                                        {projectPayment}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                                    {(["Paid", "Unpaid"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={() => void setProjectPayment(project, option)}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                                            )} />
                                                            {option}
                                                            {projectPayment === option && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                title="Monthly"
                                                aria-label="Monthly"
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition-all"
                                            >
                                                <RefreshCcw className="h-4 w-4 [stroke-width:1.5]" />
                                            </span>
                                        </div>
                                        <div className="flex justify-end">
                                            <Popover
                                                open={amountEditorProjectId === project.id}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(project)
                                                    else setAmountEditorProjectId(null)
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            openAmountEditor(project)
                                                        }}
                                                        className="font-bold text-slate-800 text-right transition-colors hover:text-blue-700"
                                                        title="Edit amount"
                                                    >
                                                        {currencyFormatter.format(getDisplayAmount(project))} <span className="text-slate-400 text-[9px]">RON</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    align="end"
                                                    className="w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Amount (RON)</p>
                                                        <input
                                                            value={amountDraft}
                                                            onChange={(event) => setAmountDraft(event.target.value)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault()
                                                                    void saveProjectAmount(project)
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setAmountEditorProjectId(null)
                                                                }
                                                            }}
                                                            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                            autoFocus
                                                        />
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                                                                onClick={() => setAmountEditorProjectId(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                                                onClick={() => void saveProjectAmount(project)}
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="relative h-8 w-8">
                                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                                    <circle className="stroke-slate-100 dark:stroke-zinc-800" strokeWidth="3" fill="transparent" r="16" cx="18" cy="18" />
                                                    <circle
                                                        className="stroke-blue-600 transition-all duration-500"
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
                                                    <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">{project.completedTasks}/{totalTasks}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                className={cn(
                                                    "px-2 py-1 rounded-lg text-[10px] font-bold text-center uppercase tracking-tight min-w-[50px] border",
                                                    overAllocated
                                                        ? "text-rose-800 bg-rose-100 border-rose-300 ring-1 ring-rose-200 shadow-sm font-black"
                                                        : "text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                                                )}
                                            >
                                                {formatDuration(project.secondsLogged)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 truncate block">{project.site.partner.name}</span>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.updatedAt} />
                                        </div>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.createdAt} />
                                        </div>
                                    </div>
                                </React.Fragment>
                            )
                        })}


                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {/* Projects Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-inner">
                                <Layers className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Inventory</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold tracking-tight text-slate-900 leading-none mb-1">{totals.count} Projects</p>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    <Zap className="h-3 w-3" />
                                    {oneTimeCount} One-time
                                </span>
                                <span className="flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                    <RefreshCcw className="h-3 w-3" />
                                    {monthlyCount} Monthly
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-inner">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Total Value</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold tracking-tight text-slate-900 leading-none mb-1">
                                {currencyFormatter.format(totals.totalAmount)} <span className="text-sm font-medium text-slate-400 uppercase tracking-tighter ml-0.5">RON</span>
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">Gross revenue for visible projects</p>
                        </div>
                    </div>

                    {/* Effort Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-inner">
                                <Timer className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Logged Time</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-bold tracking-tight text-slate-900 leading-none mb-1">{formatDuration(totals.totalSeconds)}</p>
                            <p className="text-[11px] font-medium text-slate-500">Total accumulated effort</p>
                        </div>
                    </div>
                </div>

                {/* Global Shadow Row - Bottom */}
                {layout === "list" && (
                    <div className="pt-8 pb-24">
                        {createProjectOpen ? (
                            <InlineQuickAddRow
                                partners={partners}
                                services={services}
                                onCancel={() => setCreateProjectOpen(false)}
                                gridColumns={LIST_GRID_COLUMNS}
                                autoFocus
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setCreateProjectOpen(true)}
                                className={cn("w-full text-left grid gap-x-2 items-center rounded-xl border border-dashed border-primary/30 bg-primary/5 px-6 py-4 transition-all hover:bg-primary/10 group/shadow", LIST_GRID_COLUMNS)}
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
                )}
            </div>
        </div>
    )
}
