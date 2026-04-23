"use client"

import * as React from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import {
    ArrowUpRight,
    CheckCheck,
    MoreVertical,
    Pause,
    Play,
    Square,
} from "lucide-react"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
    return format(parsed, "MMMM yyyy").toUpperCase()
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    renderMenu,
    isSelected,
    className,
    compact = false,
}: TaskGridCardProps) {
    const { timerState, startTimer, stopTimer, pauseTimer, resumeTimer } = useTimer()

    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const isPaused = isActiveTimerThisTask && !timerState.isRunning && timerState.elapsedSeconds > 0

    const services = task.project?.services || []
    const serviceLabel = services.find((service) => service.serviceName?.trim())?.serviceName?.trim()
    const projectDomain = task.project?.site?.domainName || "No domain"
    const isOverdue = task.status !== "Completed" && task.deadline ? isBefore(new Date(task.deadline), startOfDay(new Date())) : false
    const monthYearLabel = toMonthYearLabel(task.project?.createdAt || task.createdAt)
    const secondaryLine = [serviceLabel || task.project?.name || "Task", monthYearLabel].filter(Boolean).join(" ")
    const flag = getTaskFlag({ urgency: task.urgency || "Normal", status: task.status || "Active", isOverdue })

    return (
        <div
            className={cn(
                "group relative flex h-full cursor-pointer flex-col overflow-hidden border-[1.5px] border-[var(--line-subtle)] bg-[var(--surface-lowest)] transition-all duration-200",
                compact ? "rounded-[22px] p-4" : "rounded-[24px] p-4 sm:p-5",
                "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
                isRunning && "border-blue-300 bg-blue-50/30 shadow-[0_0_0_2px_rgba(37,99,235,0.15)]",
                isSelected && "border-primary/30 bg-primary/[0.02] shadow-[0_0_0_2px_rgba(var(--primary),0.1)]",
                className
            )}
            onClick={() => onOpen(task.id)}
        >
            {isRunning && (
                <div className={cn("absolute inset-x-0 top-0 h-[2.5px] bg-blue-500 animate-pulse", compact ? "rounded-t-[22px]" : "rounded-t-[24px]")} />
            )}

            <div onClick={(e) => e.stopPropagation()} className={cn("absolute right-2.5 top-2.5 z-10", compact ? "sm:right-3 sm:top-3" : "sm:right-3.5 sm:top-3.5")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                compact ? "h-7 w-7" : "h-8 w-8"
                            )}
                        >
                            <MoreVertical className={cn(compact ? "h-4 w-4" : "h-[18px] w-[18px]")} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                        {task.status !== "Completed" ? (
                            <>
                                <DropdownMenuItem
                                    onClick={() => onComplete(task.id)}
                                    className="gap-2 rounded-xl cursor-pointer text-sm font-semibold"
                                >
                                    <CheckCheck className="h-4 w-4 text-[var(--text-secondary)]" />
                                    Mark completed
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        ) : null}

                        <DropdownMenuItem
                            onClick={() => {
                                if (isRunning) {
                                    pauseTimer()
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
                            className="gap-2 rounded-xl cursor-pointer text-sm font-semibold"
                        >
                            {isRunning ? <Pause className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" /> : <Play className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />}
                            {isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                        </DropdownMenuItem>

                        {isActiveTimerThisTask ? (
                            <DropdownMenuItem
                                onClick={() => stopTimer()}
                                className="gap-2 rounded-xl cursor-pointer text-sm font-semibold"
                            >
                                <Square className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
                                Stop timer
                            </DropdownMenuItem>
                        ) : null}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => onOpen(task.id)}
                            className="gap-2 rounded-xl cursor-pointer text-sm font-semibold"
                        >
                            <ArrowUpRight className="h-4 w-4 text-[var(--text-secondary)]" />
                            Open panel
                        </DropdownMenuItem>

                        {renderMenu ? (
                            <>
                                <DropdownMenuSeparator />
                                {renderMenu(task)}
                            </>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-3" : "gap-3.5")}>
                <p className={cn(
                    "truncate pr-9 font-semibold text-[var(--text-secondary)] underline decoration-[var(--state-warning)] decoration-[1.5px] underline-offset-4",
                    compact ? "text-[11px]" : "text-[12px]"
                )}>
                    {projectDomain}
                </p>

                <h4
                    className={cn(
                        "line-clamp-2 pr-9 font-bold tracking-[-0.015em] text-[var(--text-primary)]",
                        compact ? "min-h-[2.3rem] text-[23px] leading-[1.08]" : "min-h-[2.7rem] text-[30px] leading-[1.04]",
                        task.status === "Completed" && "line-through opacity-50"
                    )}
                >
                    {task.name || "Untitled task"}
                </h4>

                <div className="h-px w-full bg-[var(--line-subtle)]" />

                <p
                    className={cn(
                        "line-clamp-2 min-h-[1.4rem] font-medium tracking-[0.01em] text-[var(--text-secondary)]",
                        compact ? "text-[12px] leading-5" : "text-[13px] leading-[1.45rem]"
                    )}
                    title={secondaryLine}
                >
                    {secondaryLine}
                </p>

                <div className="mt-auto pt-1">
                    <span
                        className={cn(
                            "inline-flex items-center justify-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.07em]",
                            compact ? "h-6" : "h-7",
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
