"use client"

import * as React from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import {
    CheckCheck,
    MoreVertical,
    Play,
} from "lucide-react"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
}

const URGENT_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-urgent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_16%,transparent)] text-[var(--state-urgent)]"
const OVERDUE_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-overdue)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_16%,transparent)] text-[var(--state-overdue)]"
const IDEA_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--text-muted)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] text-[var(--text-secondary)]"
const ACTIVE_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--primary-container)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--primary-container)_14%,transparent)] text-[var(--primary)]"
const COMPLETED_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-success)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,transparent)] text-[var(--state-success)]"
const PAUSED_BADGE_THEME_CLASS = "border border-[color:color-mix(in_srgb,var(--state-warning)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_14%,transparent)] text-[var(--state-warning)]"

function getTaskFlag({
    urgency,
    status,
    isOverdue,
}: {
    urgency: string
    status: string
    isOverdue: boolean
}) {
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
    return format(parsed, "MMMM yyyy")
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    isSelected,
    className,
    compact = true,
}: TaskGridCardProps) {
    const { timerState, startTimer, resumeTimer } = useTimer()

    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const isPaused = isActiveTimerThisTask && !timerState.isRunning && timerState.elapsedSeconds > 0

    const services = task.project?.services || []
    const serviceLabels = Array.from(
        new Set(
            services
                .map((service) => service.serviceName?.trim())
                .filter((serviceName): serviceName is string => Boolean(serviceName))
        )
    )
    const isRecurring = services.some((service) => service.isRecurring)
    const projectDomain = task.project?.site?.domainName || "No domain"
    const isOverdue = task.status !== "Completed" && task.deadline ? isBefore(new Date(task.deadline), startOfDay(new Date())) : false
    const recurringMonthLabel = isRecurring ? toMonthYearLabel(task.project?.createdAt || task.createdAt) : ""
    const servicesLine = serviceLabels.length > 0 ? serviceLabels.join(" · ") : (task.project?.name || "Task")
    const secondaryLine = [servicesLine, recurringMonthLabel].filter(Boolean).join(" · ")
    const flag = getTaskFlag({ urgency: task.urgency || "Normal", status: task.status || "Active", isOverdue })
    const topPillSizeClass = compact ? "h-[18px] px-2 text-[10px] leading-4" : "h-[22px] px-2 text-[11px] leading-4"

    return (
        <div
            className={cn(
                "group relative flex h-full cursor-pointer flex-col overflow-hidden border border-[color:color-mix(in_srgb,var(--line-subtle)_90%,transparent)] bg-[var(--surface-lowest)] transition-all duration-200",
                compact ? "rounded-[16px] px-2.5 py-3" : "rounded-[18px] p-3.5",
                "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                isRunning && "border-[color:color-mix(in_srgb,var(--primary)_42%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_10%,var(--surface-lowest))]",
                isSelected && "border-[color:color-mix(in_srgb,var(--primary)_34%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary)_8%,var(--surface-lowest))]",
                className
            )}
            onClick={() => onOpen(task.id)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(task.id)
                }
            }}
            role="button"
            tabIndex={0}
        >
            {isRunning && (
                <div className={cn("absolute inset-x-0 top-0 h-[1.5px] bg-[var(--primary)] animate-pulse", compact ? "rounded-t-[16px]" : "rounded-t-[18px]")} />
            )}

            <div onClick={(e) => e.stopPropagation()} className={cn("absolute right-1.5 top-1.5 z-10", compact ? "sm:right-2 sm:top-2" : "sm:right-2.5 sm:top-2.5")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                compact ? "h-[22px] w-[22px]" : "h-7 w-7"
                            )}
                        >
                            <MoreVertical className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2 shadow-xl">
                        <DropdownMenuItem
                            onClick={() => {
                                if (task.status === "Completed") {
                                    return
                                }
                                onComplete(task.id)
                            }}
                            disabled={task.status === "Completed"}
                            className="min-h-11 gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            <CheckCheck className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
                            Complete task
                        </DropdownMenuItem>

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
                                if (!task.projectId) {
                                    toast.error("Task has no project")
                                    return
                                }
                                startTimer(task.projectId, task.id, task.name || "Task")
                            }}
                            className="min-h-11 gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer"
                        >
                            <Play className="h-4.5 w-4.5 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
                            Start timer
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-1" : "gap-2.5")}>
                <div className="flex items-start justify-between gap-2 pr-7 sm:pr-8">
                    <div className="min-w-0 flex-1">
                        <p
                            className={cn(
                                "inline-flex max-w-full items-center rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,transparent)]",
                                topPillSizeClass
                            )}
                            title={projectDomain}
                        >
                            <span className="truncate font-semibold text-[var(--text-secondary)]">{projectDomain}</span>
                        </p>
                    </div>
                    <span
                        className={cn(
                            "hidden shrink-0 items-center justify-center rounded-full font-black uppercase tracking-[0.07em] sm:inline-flex",
                            topPillSizeClass,
                            flag.className
                        )}
                    >
                        {flag.label}
                    </span>
                </div>

                <h4
                    className={cn(
                        "pr-8 font-bold tracking-[-0.015em] text-[var(--text-primary)] whitespace-normal break-words",
                        compact ? "py-2 text-[16px] leading-[1.14]" : "min-h-[2.25rem] text-[19px] leading-[1.12]",
                        task.status === "Completed" && "line-through opacity-50"
                    )}
                >
                    {task.name || "Untitled task"}
                </h4>

                <div className="h-px w-full bg-[var(--line-subtle)]" />

                <p
                    className={cn(
                        "line-clamp-1 min-h-[1rem] font-medium tracking-[0.01em] text-[var(--text-secondary)]",
                        compact ? "text-[10px] leading-4" : "text-[11px] leading-[1.1rem]"
                    )}
                    title={secondaryLine}
                >
                    {secondaryLine}
                </p>

                <div className="mt-auto sm:hidden">
                    <span
                        className={cn(
                            "inline-flex items-center justify-center rounded-full px-2 text-[8px] font-black uppercase tracking-[0.07em]",
                            compact ? "h-[18px]" : "h-[22px]",
                            flag.className
                        )}
                    >
                        {flag.label}
                    </span>
                </div>
            </div>
        </div>
    )
}
