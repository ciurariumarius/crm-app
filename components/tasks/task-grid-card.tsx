"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    ArrowDown,
    ArrowUpRight,
    Check,
    CheckCircle2,
    ChevronUp,
    CircleDot,
    Clock,
    Play,
    Pause,
} from "lucide-react"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import { setTaskStatus, updateTask } from "@/lib/actions/tasks"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { TaskActualTimeQuickEdit } from "@/components/tasks/task-actual-time-quick-edit"
import { LmsIcon } from "@/components/lms/lms-icon"

export const TASK_CARD_SHELL_CLASS =
    "relative flex min-h-[185px] w-full overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--line-subtle)_90%,transparent)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] transition-all duration-200 sm:min-h-[200px] xl:min-h-[210px]"

interface TaskGridCardProps {
    task: TaskCardItem
    onOpen: (taskId: string) => void
    onComplete: (taskId: string) => void
    renderMenu?: (task: TaskCardItem) => React.ReactNode
    isSelected?: boolean
    onSelect?: (taskId: string) => void
    className?: string
    compact?: boolean
}

type TaskCardService = {
    isRecurring?: boolean | null
    serviceName?: string | null
}

type TaskCardProject = {
    name?: string | null
    createdAt?: string | Date | null
    site?: { domainName?: string | null } | null
    services?: TaskCardService[] | null
}

type TaskCardItem = {
    id: string
    name?: string | null
    status?: string | null
    projectId?: string | null
    urgency?: string | null
    deadline?: string | Date | null
    createdAt?: string | Date | null
    estimatedMinutes?: number | null
    timeLogs?: Array<{ durationSeconds?: number | null }> | null
    project?: TaskCardProject | null
    taskScope?: string | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null } | null
    lmsWorkEntry?: { id?: string; durationMinutes?: number | null } | null
}

function getPriorityPill(urgency: string | null | undefined) {
    const priority = normalizeTaskUrgency(urgency)
    if (priority === "High") {
        return {
            label: "High",
            className: "border border-rose-200/80 bg-rose-50/90 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400",
            icon: <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    if (priority === "Low") {
        return {
            label: "Low",
            className: "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
            icon: <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    return {
        label: "Medium",
        className: "border border-amber-200/80 bg-amber-50/90 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
        icon: <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />,
    }
}

function getStatusPill(status: string | null | undefined) {
    const norm = normalizeTaskStatus(status)
    if (norm === "Completed") {
        return {
            label: "Done",
            className: "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
            icon: <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    if (norm === "Pending") {
        return {
            label: "Pending",
            className: "border border-amber-200/80 bg-amber-50/90 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
            icon: <Clock className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    return {
        label: "Active",
        className: "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
        icon: <CircleDot className="h-3.5 w-3.5 stroke-[2.5]" />,
    }
}

function toMonthYearLabel(value: string | Date | null | undefined) {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return format(parsed, "MMM yyyy")
}

function formatCompactAgo(date: Date | string | null | undefined): string {
    if (!date) return ""
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return ""
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - d.getTime())
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return "just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 4) return `${diffWeeks}w ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    renderMenu: _renderMenu,
    isSelected,
    className,
    compact: _compact,
}: TaskGridCardProps) {
    const router = useRouter()
    const { timerState } = useTimer()
    void _compact
    void _renderMenu

    const [currentUrgency, setCurrentUrgency] = React.useState(task.urgency)
    const [isUpdatingPriority, setIsUpdatingPriority] = React.useState(false)
    const [currentStatus, setCurrentStatus] = React.useState(task.status || "Active")
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)

    React.useEffect(() => {
        setCurrentUrgency(task.urgency)
    }, [task.urgency])

    React.useEffect(() => {
        setCurrentStatus(task.status || "Active")
    }, [task.status])

    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const services = task.project?.services || []
    const serviceLabels = Array.from(new Set(
        services
            .map((service) => service.serviceName?.trim())
            .filter((serviceName): serviceName is string => Boolean(serviceName))
    ))
    const isRecurring = services.some((service) => service.isRecurring)
    const isLmsTask = task.taskScope === "LMS"
    const scopeLabel = isLmsTask ? "LMS" : task.taskScope === "GENERAL" ? "General" : "Freelance"
    const projectLabel = isLmsTask
        ? task.lmsAllocation?.client || "LMS project"
        : task.project?.site?.domainName || task.project?.name || "No Project"
    const recurringMonthLabel = isRecurring ? toMonthYearLabel(task.project?.createdAt || task.createdAt) : ""
    const categoryChips = React.useMemo(() => {
        if (isLmsTask) return [task.lmsTaskType?.name || "LMS Task"]
        const chips: string[] = []
        if (serviceLabels.length > 0) {
            chips.push(...serviceLabels)
        } else if (task.project?.name) {
            chips.push(task.project.name)
        }
        if (recurringMonthLabel) {
            chips.push(recurringMonthLabel)
        }
        if (chips.length === 0) {
            chips.push("General")
        }
        return chips
    }, [isLmsTask, task.lmsTaskType?.name, serviceLabels, task.project?.name, recurringMonthLabel])
    const priorityPill = getPriorityPill(currentUrgency)
    const statusPill = getStatusPill(currentStatus)
    const sessionSeconds = task.timeLogs?.reduce(
        (total, log) => total + Math.max(0, log.durationSeconds || 0),
        0
    ) || 0
    const loggedSeconds = sessionSeconds > 0
        ? sessionSeconds
        : Math.max(0, task.lmsWorkEntry?.durationMinutes || 0) * 60
    const displayedTrackedSeconds = loggedSeconds + (isActiveTimerThisTask ? timerState.elapsedSeconds : 0)
    const compactAgo = formatCompactAgo(task.createdAt)

    const { requestReopen, pendingTaskId } = useTaskCompletion()

    const handlePrioritySelect = async (nextPriority: "High" | "Medium" | "Low") => {
        if (normalizeTaskUrgency(currentUrgency) === nextPriority) return
        const previousUrgency = currentUrgency
        setCurrentUrgency(nextPriority)
        setIsUpdatingPriority(true)
        try {
            const res = await updateTask(task.id, { urgency: nextPriority })
            if (res.success) {
                toast.success(`Priority set to ${nextPriority}`)
                router.refresh()
            } else {
                setCurrentUrgency(previousUrgency)
                toast.error(res.error || "Failed to update priority")
            }
        } catch {
            setCurrentUrgency(previousUrgency)
            toast.error("Failed to update priority")
        } finally {
            setIsUpdatingPriority(false)
        }
    }

    const handleStatusSelect = async (nextStatus: "Active" | "Pending" | "Done") => {
        const targetStatus = nextStatus === "Done" ? "Completed" : nextStatus
        const normalizedCurrent = normalizeTaskStatus(currentStatus)
        if (normalizedCurrent === targetStatus) return

        if (targetStatus === "Completed") {
            onComplete(task.id)
            return
        }

        if (normalizedCurrent === "Completed") {
            const reopened = await requestReopen(task)
            if (reopened) {
                if (targetStatus === "Pending") {
                    const res = await setTaskStatus(task.id, "Pending")
                    if (res.success) {
                        setCurrentStatus("Pending")
                        toast.success("Task marked Pending")
                        router.refresh()
                    }
                } else {
                    setCurrentStatus("Active")
                    router.refresh()
                }
            }
            return
        }

        const prev = currentStatus
        setCurrentStatus(targetStatus)
        setIsUpdatingStatus(true)
        try {
            const res = await setTaskStatus(task.id, targetStatus)
            if (res.success) {
                toast.success(`Task marked ${targetStatus}`)
                router.refresh()
            } else {
                setCurrentStatus(prev)
                toast.error(res.error || `Failed to set status to ${targetStatus}`)
            }
        } catch {
            setCurrentStatus(prev)
            toast.error("Failed to update task status")
        } finally {
            setIsUpdatingStatus(false)
        }
    }

    const isCompleted = normalizeTaskStatus(currentStatus) === "Completed"
    const isPending = normalizeTaskStatus(currentStatus) === "Pending"

    return (
        <article
            data-task-card-id={task.id}
            className={cn(
                TASK_CARD_SHELL_CLASS,
                "group cursor-pointer flex-col justify-between p-4 outline-none hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_65%,var(--text-muted)_35%)] hover:shadow-[var(--shadow-apple)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 sm:p-5",
                isRunning && "border-[color:color-mix(in_srgb,var(--primary)_42%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_8%,var(--surface-lowest))]",
                isSelected && "border-[color:color-mix(in_srgb,var(--primary)_40%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_7%,var(--surface-lowest))] ring-2 ring-[color:color-mix(in_srgb,var(--primary)_16%,transparent)]",
                isCompleted && "bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
                className
            )}
            onClick={() => onOpen(task.id)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(task.id)
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open task: ${task.name || "Untitled task"}`}
        >
            {isRunning ? <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-[20px] bg-[var(--primary)] animate-pulse" /> : null}

            <div>
                {/* TOP ROW: Scope on Left, Priority & Status Dropdown Icon on Right */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
                    <span className="inline-flex h-6 min-w-0 max-w-[48%] shrink items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,transparent)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                        {isLmsTask ? <LmsIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                        <span className="truncate">{scopeLabel}</span>
                    </span>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    disabled={isUpdatingPriority}
                                    className={cn(
                                        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-all cursor-pointer hover:opacity-80 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50",
                                        priorityPill.className
                                    )}
                                    title={`Priority: ${priorityPill.label}. Click to change`}
                                    aria-label={`Change priority, currently ${priorityPill.label}`}
                                >
                                    {priorityPill.icon}
                                    <span>{priorityPill.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                    Priority
                                </div>
                                {(["High", "Medium", "Low"] as const).map((priorityOption) => {
                                    const pillInfo = getPriorityPill(priorityOption)
                                    const isCurrent = normalizeTaskUrgency(currentUrgency) === priorityOption
                                    return (
                                        <DropdownMenuItem
                                            key={priorityOption}
                                            onSelect={(event) => {
                                                event.stopPropagation()
                                                void handlePrioritySelect(priorityOption)
                                            }}
                                            className="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                                        >
                                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", pillInfo.className)}>
                                                {pillInfo.icon}
                                                <span>{priorityOption}</span>
                                            </span>
                                            {isCurrent ? <Check className="ml-auto h-3.5 w-3.5 text-[var(--primary)]" /> : null}
                                        </DropdownMenuItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    disabled={isUpdatingStatus || pendingTaskId === task.id}
                                    className={cn(
                                        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-all cursor-pointer hover:opacity-80 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50",
                                        statusPill.className
                                    )}
                                    title={`Status: ${statusPill.label}. Click to change`}
                                    aria-label={`Change task status, currently ${statusPill.label}`}
                                >
                                    {statusPill.icon}
                                    <span>{statusPill.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                    Status
                                </div>
                                {(["Active", "Pending", "Done"] as const).map((statusOption) => {
                                    const pillInfo = getStatusPill(statusOption === "Done" ? "Completed" : statusOption)
                                    const isCurrent = (statusOption === "Done" && isCompleted)
                                        || (statusOption === "Pending" && isPending)
                                        || (statusOption === "Active" && !isCompleted && !isPending)
                                    return (
                                        <DropdownMenuItem
                                            key={statusOption}
                                            onSelect={(event) => {
                                                event.stopPropagation()
                                                void handleStatusSelect(statusOption)
                                            }}
                                            className="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                                        >
                                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", pillInfo.className)}>
                                                {pillInfo.icon}
                                                <span>{statusOption}</span>
                                            </span>
                                            {isCurrent ? <Check className="ml-auto h-3.5 w-3.5 text-[var(--primary)]" /> : null}
                                        </DropdownMenuItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* MIDDLE SECTION: Task Name (Title) & Project Domain (Subtitle) */}
                <div className="mt-3.5 min-w-0">
                    <h3 className={cn(
                        "line-clamp-2 text-[16px] sm:text-[17px] font-bold leading-snug tracking-[-0.015em] text-[var(--text-primary)]",
                        isCompleted && "line-through opacity-55"
                    )}>
                        {task.name || "Untitled task"}
                    </h3>
                    <p className="mt-1 truncate text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)]">
                        {projectLabel}
                    </p>
                </div>
            </div>

            {/* CARD FOOTER: Divider, Tags, and Time/Date Bottom Row */}
            <div className="mt-auto pt-3">
                <div className="border-t border-[var(--line-subtle)] pt-3">
                    <div className="flex flex-wrap min-w-0 items-center gap-1.5">
                        {categoryChips.map((chip, idx) => (
                            <span
                                key={idx}
                                className="inline-flex max-w-full items-center rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--text-secondary)] truncate border border-[var(--line-subtle)]"
                            >
                                {chip}
                            </span>
                        ))}
                    </div>

                    <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
                        <TaskActualTimeQuickEdit
                            taskId={task.id}
                            taskName={task.name}
                            totalSeconds={displayedTrackedSeconds}
                            disabled={isActiveTimerThisTask}
                        />
                        {compactAgo ? (
                            <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                                {compactAgo}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </article>
    )
}
