"use client"

import * as React from "react"
import { format, isBefore, isToday, startOfDay } from "date-fns"
import { CalendarDays, CheckCheck, MoreVertical, Play } from "lucide-react"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"

export const TASK_CARD_SHELL_CLASS =
    "relative flex min-h-[176px] w-full overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--line-subtle)_90%,transparent)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] transition-all duration-200 sm:aspect-[4/3] sm:min-h-[190px] xl:min-h-[205px]"

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
    project?: TaskCardProject | null
    taskScope?: string | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null } | null
}

const URGENT_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-urgent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_16%,transparent)] text-[var(--state-urgent)]"
const OVERDUE_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-overdue)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_16%,transparent)] text-[var(--state-overdue)]"
const IDEA_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--text-muted)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] text-[var(--text-secondary)]"
const ACTIVE_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--primary-container)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--primary-container)_14%,transparent)] text-[var(--primary)]"
const COMPLETED_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-success)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,transparent)] text-[var(--state-success)]"
const PAUSED_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-warning)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_14%,transparent)] text-[var(--state-warning)]"

function getTaskFlag({ urgency, status, isOverdue }: { urgency: string; status: string; isOverdue: boolean }) {
    const normalizedUrgency = normalizeTaskUrgency(urgency)

    if (status === "Completed") return { label: "Completed", className: COMPLETED_BADGE_THEME_CLASS }
    if (status === "Paused") return { label: "Paused", className: PAUSED_BADGE_THEME_CLASS }
    if (isOverdue) return { label: "Overdue", className: OVERDUE_BADGE_THEME_CLASS }
    if (normalizedUrgency === "Urgent") return { label: "Urgent", className: URGENT_BADGE_THEME_CLASS }
    if (normalizedUrgency === "Idea") return { label: "Idea", className: IDEA_BADGE_THEME_CLASS }
    return { label: status || "Active", className: ACTIVE_BADGE_THEME_CLASS }
}

function toMonthYearLabel(value: string | Date | null | undefined) {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return format(parsed, "MMM yyyy")
}

function toDeadlineLabel(value: string | Date | null | undefined) {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return isToday(parsed) ? "Due today" : `Due ${format(parsed, "dd MMM")}`
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    renderMenu,
    isSelected,
    className,
    compact: _compact,
}: TaskGridCardProps) {
    const { timerState, startTimer, resumeTimer } = useTimer()
    void _compact

    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const isPaused = isActiveTimerThisTask && !timerState.isRunning && timerState.elapsedSeconds > 0
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
        ? task.lmsAllocation?.client || "LMS project not linked"
        : task.project?.site?.domainName || task.project?.name || "Project not linked"
    const recurringMonthLabel = isRecurring ? toMonthYearLabel(task.project?.createdAt || task.createdAt) : ""
    const categoryLabel = isLmsTask
        ? task.lmsTaskType?.name || "Work category not linked"
        : [serviceLabels.join(" · ") || task.project?.name, recurringMonthLabel].filter(Boolean).join(" · ") || "No service details"
    const deadlineLabel = toDeadlineLabel(task.deadline)
    const isOverdue = task.status !== "Completed" && task.deadline
        ? isBefore(new Date(task.deadline), startOfDay(new Date()))
        : false
    const flag = getTaskFlag({ urgency: task.urgency || "Normal", status: task.status || "Active", isOverdue })

    return (
        <article
            data-task-card-id={task.id}
            className={cn(
                TASK_CARD_SHELL_CLASS,
                "group cursor-pointer flex-col p-4 outline-none hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_65%,var(--text-muted)_35%)] hover:shadow-[var(--shadow-apple)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 sm:p-5",
                isRunning && "border-[color:color-mix(in_srgb,var(--primary)_42%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_8%,var(--surface-lowest))]",
                isSelected && "border-[color:color-mix(in_srgb,var(--primary)_40%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_7%,var(--surface-lowest))] ring-2 ring-[color:color-mix(in_srgb,var(--primary)_16%,transparent)]",
                task.status === "Completed" && "bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
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

            <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-6 min-w-0 max-w-[45%] items-center rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,transparent)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                    <span className="truncate">{scopeLabel}</span>
                </span>

                <div className="flex min-w-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <span className={cn("inline-flex h-6 max-w-28 items-center justify-center truncate rounded-full px-2.5 text-xs font-black uppercase tracking-[0.06em]", flag.className)}>
                        {flag.label}
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Open task actions"
                                title="Task actions"
                                className="h-8 w-8 shrink-0 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2 shadow-xl">
                            <DropdownMenuItem
                                onClick={() => {
                                    if (task.status !== "Completed") onComplete(task.id)
                                }}
                                disabled={task.status === "Completed"}
                                className="min-h-11 gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                <CheckCheck className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
                                Complete task
                            </DropdownMenuItem>

                            {!isLmsTask && task.projectId ? (
                                <DropdownMenuItem
                                    onClick={() => {
                                        if (isRunning) {
                                            toast.message("Timer already running")
                                            return
                                        }
                                        if (isPaused) {
                                            resumeTimer()
                                            return
                                        }
                                        startTimer(task.projectId as string, task.id, task.name || "Task")
                                    }}
                                    className="min-h-11 gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer"
                                >
                                    <Play className="h-4.5 w-4.5 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
                                    {isPaused ? "Resume timer" : "Start timer"}
                                </DropdownMenuItem>
                            ) : null}
                            {renderMenu?.(task)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <h3 className={cn(
                "mt-4 line-clamp-2 pr-1 text-[19px] font-bold leading-[1.18] tracking-[-0.02em] text-[var(--text-primary)] sm:text-xl",
                task.status === "Completed" && "line-through opacity-55"
            )}>
                {task.name || "Untitled task"}
            </h3>

            <div className="mt-auto border-t border-[var(--line-subtle)] pt-4">
                <p className="line-clamp-2 text-[15px] font-bold leading-5 tracking-[-0.01em] text-[var(--text-primary)]" title={projectLabel}>
                    {projectLabel}
                </p>
                <div className="mt-1.5 flex min-w-0 items-end justify-between gap-3">
                    <p className="line-clamp-2 min-w-0 text-[13px] font-medium leading-[1.15rem] text-[var(--text-secondary)]" title={categoryLabel}>
                        {categoryLabel}
                    </p>
                    {deadlineLabel ? (
                        <span className={cn(
                            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold",
                            isOverdue ? "text-[var(--state-overdue)]" : "text-[var(--text-muted)]"
                        )}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            {deadlineLabel}
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    )
}
