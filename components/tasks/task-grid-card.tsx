"use client"

import * as React from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import {
    ArrowUpRight,
    CheckCheck,
    Lightbulb,
    MoreVertical,
    Pause,
    Play,
    RefreshCcw,
    Square,
    Circle,
} from "lucide-react"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { StatusChip } from "@/components/ui/status-chip"
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

function PriorityBadge({ urgency, compact = false }: { urgency: string; compact?: boolean }) {
    const normalizedUrgency = normalizeTaskUrgency(urgency)
    const size = compact ? "xs" : "sm"

    if (normalizedUrgency === "Urgent") {
        if (compact) {
            return (
                <div className="inline-flex h-5 items-center justify-center rounded-full border border-rose-100 bg-rose-50/50 px-2 text-[10px] font-black uppercase tracking-wider text-rose-500">
                    Urgent
                </div>
            )
        }
        return (
            <StatusChip tone="urgent" size="sm">
                Urgent
            </StatusChip>
        )
    }
    if (normalizedUrgency === "Idea") {
        return (
            <StatusChip tone="idea" size={size} icon={<Lightbulb className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}>
                Idea
            </StatusChip>
        )
    }
    return null
}

function DeadlineBadge({ deadline, compact = false }: { deadline: string | Date | null | undefined; compact?: boolean }) {
    if (!deadline) return null
    const date = new Date(deadline)
    if (Number.isNaN(date.getTime())) return null

    const overdue = isBefore(date, startOfDay(new Date()))
    if (compact) {
        if (!overdue) return null
        return (
            <div className="inline-flex h-5 items-center justify-center rounded-full border border-orange-100 bg-orange-50/50 px-2 text-[10px] font-black uppercase tracking-wider text-orange-500">
                Overdue
            </div>
        )
    }

    const label = format(date, "d MMMM")

    return (
        <StatusChip tone={overdue ? "urgent" : "unpaid"} size="sm">
            {label}
        </StatusChip>
    )
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
    const isRecurring = services.some((s: TaskCardService) => s.isRecurring)
    const projectFullName = task.project ? formatProjectName(task.project) : "No Project"
    const projectDomain = task.project?.site?.domainName || "No domain"
    const isOverdue = task.deadline ? isBefore(new Date(task.deadline), startOfDay(new Date())) : false
    const normalizedUrgency = normalizeTaskUrgency(task.urgency || "Normal")
    const hasTopLabels = normalizedUrgency === "Urgent" || normalizedUrgency === "Idea" || isOverdue

    if (compact) {
        return (
            <div
                className={cn(
                    "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.03)] transition-all duration-200 sm:p-4",
                    "hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
                    isRunning && "border-blue-200 bg-blue-50/20",
                    isSelected && "border-primary/30 bg-primary/[0.02]",
                    className
                )}
                onClick={() => onOpen(task.id)}
            >
                <div onClick={(e) => e.stopPropagation()} className="absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            {task.status !== "Completed" ? (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => onComplete(task.id)}
                                        className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
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
                                className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                            >
                                {isRunning ? <Pause className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" /> : <Play className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />}
                                {isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                            </DropdownMenuItem>

                            {isActiveTimerThisTask ? (
                                <DropdownMenuItem
                                    onClick={() => stopTimer()}
                                    className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                >
                                    <Square className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
                                    Stop timer
                                </DropdownMenuItem>
                            ) : null}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => onOpen(task.id)}
                                className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
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

                {hasTopLabels ? (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-8 sm:gap-2">
                        <PriorityBadge urgency={task.urgency || "Normal"} compact />
                        <DeadlineBadge deadline={task.deadline} compact />
                    </div>
                ) : null}

                <h4
                    className={cn(
                        "line-clamp-2 pr-7 text-[15px] font-bold leading-[1.28] tracking-tight text-[var(--text-primary)] sm:pr-8 sm:text-[16px]",
                        task.status === "Completed" && "line-through opacity-40"
                    )}
                >
                    {task.name || "Untitled task"}
                </h4>

                <div className="mt-1 min-w-0 sm:mt-1.5">
                    <div className="flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
                        {isRecurring
                            ? <RefreshCcw className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                            : <Circle className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                        }
                        <p className="min-w-0 truncate text-[11px] font-medium text-[var(--text-secondary)] sm:text-[12px]">
                            {projectFullName}
                        </p>
                    </div>
                </div>

            </div>
        )
    }

    return (
        <div
            className={cn(
                "group relative self-start cursor-pointer border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] transition-all duration-200",
                compact ? "rounded-2xl shadow-sm" : "rounded-3xl",
                "hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[0_8px_30px_-8px_rgba(15,23,42,0.15)]",
                isOverdue && "border-rose-200/80 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]",
                isRunning && "border-blue-300 bg-blue-50/30 shadow-[0_0_0_2px_rgba(37,99,235,0.15)]",
                isSelected && "border-primary/30 bg-primary/[0.02] shadow-[0_0_0_2px_rgba(var(--primary),0.1)]",
                className
            )}
            onClick={() => onOpen(task.id)}
        >
            {/* Running timer indicator */}
            {isRunning && (
                <div className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-3xl bg-blue-500 animate-pulse" />
            )}

            <div className={cn("flex flex-col", compact ? "gap-2.5 p-3.5 sm:p-4" : "gap-3 p-4")}>
                <div onClick={(e) => e.stopPropagation()} className="absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                {task.status !== "Completed" ? (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => onComplete(task.id)}
                                            className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
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
                                    className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                >
                                    {isRunning ? <Pause className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" /> : <Play className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />}
                                    {isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                                </DropdownMenuItem>

                                {isActiveTimerThisTask ? (
                                    <DropdownMenuItem
                                        onClick={() => stopTimer()}
                                        className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                    >
                                        <Square className="h-4 w-4 fill-[var(--text-secondary)] text-[var(--text-secondary)]" />
                                        Stop timer
                                    </DropdownMenuItem>
                                ) : null}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onClick={() => onOpen(task.id)}
                                    className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
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

                {hasTopLabels ? (
                    <div className="flex flex-wrap items-center gap-1.5 pr-8 sm:gap-2">
                        <PriorityBadge urgency={task.urgency || "Normal"} compact={compact} />
                        <DeadlineBadge deadline={task.deadline} compact={compact} />
                    </div>
                ) : null}

                <h4 className={cn(
                    "line-clamp-2 flex-1 pr-7 font-bold leading-tight text-[var(--text-primary)] sm:pr-8",
                    compact ? "min-h-[2rem] pt-0 text-[14px] sm:min-h-[2.15rem] sm:text-[15px]" : "min-h-[2.5rem] pt-0.5 text-[16px]",
                    task.status === "Completed" && "line-through opacity-40"
                )}>
                    {task.name || "Untitled task"}
                </h4>

                {/* Project subtitle */}
                {compact ? (
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {isRecurring
                                ? <RefreshCcw className="h-2.5 w-2.5 shrink-0 text-[var(--text-muted)] sm:h-3 sm:w-3" />
                                : <Circle className="h-2.5 w-2.5 shrink-0 text-[var(--text-muted)] sm:h-3 sm:w-3" />
                            }
                            <p className="min-w-0 truncate text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">{projectDomain}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-1.5 min-w-0">
                        {isRecurring
                            ? <RefreshCcw className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                            : <Circle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                        }
                        <p className="min-w-0 min-h-[2rem] line-clamp-2 text-[12px] font-medium leading-snug tracking-tight text-[var(--text-muted)]">
                            {projectFullName}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
