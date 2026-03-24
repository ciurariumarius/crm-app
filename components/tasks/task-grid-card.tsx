"use client"

import * as React from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn, formatProjectName, formatProjectServiceList } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import {
    Calendar as CalendarIcon,
    CheckCheck,
    Lightbulb,
    MoreVertical,
    Pause,
    Play,
    RefreshCcw,
    Square,
    ArrowUpRight,
    Circle,
    Clock3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { StatusChip } from "@/components/ui/status-chip"

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
    const projectServices = services.length ? formatProjectServiceList(services, "No services") : "No services"
    const createdAtDate = task.createdAt ? new Date(task.createdAt) : null
    const hasValidCreatedAt = createdAtDate !== null && !Number.isNaN(createdAtDate.getTime())
    const isOverdue = task.deadline ? isBefore(new Date(task.deadline), startOfDay(new Date())) : false

    if (compact) {
        return (
            <div
                className={cn(
                    "group relative h-full cursor-pointer flex flex-col overflow-hidden rounded-[24px] bg-white p-5 transition-all duration-200",
                    "border border-slate-100 hover:border-slate-200 hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]",
                    isRunning && "border-blue-200 bg-blue-50/20",
                    isSelected && "border-primary/30 bg-primary/[0.02]",
                    className
                )}
                onClick={() => onOpen(task.id)}
            >

                <div className="flex items-start justify-between gap-3">
                    <h4
                        className={cn(
                            "text-[18px] font-bold leading-[1.2] text-slate-900 tracking-tight line-clamp-2",
                            task.status === "Completed" && "line-through opacity-40"
                        )}
                    >
                        {task.name || "Untitled task"}
                    </h4>

                    <div onClick={(e) => e.stopPropagation()} className="-mr-1 shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-xl border-slate-100 p-1.5 backdrop-blur-sm grayscale-[0.2]">
                                {task.status !== "Completed" && (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => onComplete(task.id)}
                                            className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                        >
                                            <CheckCheck className="h-4 w-4 text-slate-500" />
                                            Mark completed
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuItem
                                    onClick={() => {
                                        if (isRunning) {
                                            pauseTimer()
                                            toast.success("Timer paused")
                                            return
                                        }
                                        if (isPaused) {
                                            resumeTimer()
                                            toast.success("Timer resumed")
                                            return
                                        }
                                        if (!task.projectId) {
                                            toast.error("Task has no project")
                                            return
                                        }
                                        startTimer(task.projectId, task.id, task.name || "Task")
                                        toast.success("Timer started")
                                    }}
                                    className="gap-2 rounded-xl text-sm font-semibold cursor-pointer"
                                >
                                    {isRunning ? <Pause className="h-4 w-4 fill-slate-500 text-slate-500" /> : <Play className="h-4 w-4 fill-slate-500 text-slate-500" />}
                                    {isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                                </DropdownMenuItem>

                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                    </div>
                <div className="mt-3 min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5 text-slate-400">
                        {isRecurring
                            ? <RefreshCcw className="h-2.5 w-2.5 shrink-0" />
                            : <Circle className="h-2.5 w-2.5 shrink-0" />
                        }
                        <p className="min-w-0 truncate text-[12px] font-medium text-slate-500">
                            {projectFullName}
                        </p>
                    </div>
                </div>

                <div className="mt-auto flex items-end justify-between pt-5">
                    <div className="flex items-center gap-2">
                        <PriorityBadge urgency={task.urgency || "Normal"} compact />
                        <DeadlineBadge deadline={task.deadline} compact />
                    </div>

                    {hasValidCreatedAt && createdAtDate ? (
                        <div className="flex shrink-0 items-center gap-1.5 text-slate-300">
                            <CalendarIcon className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {format(createdAtDate, "d MMM")}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                "group relative self-start border bg-white cursor-pointer transition-all duration-200",
                compact ? "rounded-2xl border-slate-200 shadow-sm" : "rounded-3xl",
                "hover:shadow-[0_8px_30px_-8px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 border-slate-100",
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

            <div className={cn("flex flex-col", compact ? "gap-2.5 p-3" : "gap-3 p-4")}>
                {/* Header row: title + options menu */}
                <div className="flex items-start justify-between gap-3">
                    <h4 className={cn(
                        "line-clamp-2 flex-1 font-bold leading-tight text-slate-900",
                        compact ? "min-h-[2.15rem] pt-0 text-[15px]" : "min-h-[2.5rem] pt-0.5 text-[16px]",
                        task.status === "Completed" && "line-through opacity-40"
                    )}>
                        {task.name || "Untitled task"}
                    </h4>

                    {/* Options menu */}
                    <div onClick={e => e.stopPropagation()} className="shrink-0 -mr-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "rounded-xl text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-colors",
                                        compact ? "h-7 w-7" : "h-8 w-8"
                                    )}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100">
                                <DropdownMenuItem
                                    onClick={() => {
                                        if (isRunning) {
                                            pauseTimer()
                                            toast.success("Timer paused")
                                            return
                                        }
                                        if (isPaused) {
                                            resumeTimer()
                                            toast.success("Timer resumed")
                                            return
                                        }
                                        if (!task.projectId) {
                                            toast.error("Task has no project")
                                            return
                                        }
                                        startTimer(task.projectId, task.id, task.name || "Task")
                                        toast.success("Timer started")
                                    }}
                                    className="gap-2 text-sm font-medium cursor-pointer"
                                >
                                    {isRunning ? <Pause className="h-3.5 w-3.5 fill-current text-slate-500" /> : <Play className="h-3.5 w-3.5 fill-current text-slate-500" />}
                                    {isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                                </DropdownMenuItem>

                                {isActiveTimerThisTask && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            stopTimer()
                                            toast.success("Timer stopped")
                                        }}
                                        className="gap-2 text-sm font-medium cursor-pointer"
                                    >
                                        <Square className="h-3.5 w-3.5 fill-current text-slate-500" />
                                        Stop timer
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {task.status !== "Completed" && (
                                    <DropdownMenuItem
                                        onClick={() => onComplete(task.id)}
                                        className="gap-2 text-sm font-medium cursor-pointer"
                                    >
                                        <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
                                        Mark completed
                                    </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onOpen(task.id)}
                                    className="gap-2 text-sm font-medium cursor-pointer"
                                >
                                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
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
                </div>

                {/* Project subtitle */}
                {compact ? (
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {isRecurring
                                ? <RefreshCcw className="h-3 w-3 text-slate-400 shrink-0" />
                                : <Circle className="h-3 w-3 text-slate-400 shrink-0" />
                            }
                            <p className="min-w-0 truncate text-[11px] font-medium text-slate-400">{projectDomain}</p>
                        </div>
                        <p className="mt-1 truncate text-[10px] font-medium text-slate-300">
                            {projectServices}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-start gap-1.5 min-w-0">
                        {isRecurring
                            ? <RefreshCcw className="mt-0.5 h-3 w-3 text-slate-400 shrink-0" />
                            : <Circle className="mt-0.5 h-3 w-3 text-slate-400 shrink-0" />
                        }
                        <p className="min-w-0 text-[12px] font-medium text-slate-400 line-clamp-2 leading-snug tracking-tight min-h-[2rem]">
                            {projectFullName}
                        </p>
                    </div>
                )}

                {/* Badges: priority + deadline + absolute date */}
                <div className={cn("flex items-end justify-between mt-auto", compact ? "pt-1.5" : "pt-2")}>
                    <div className="flex items-center gap-2">
                        <PriorityBadge urgency={task.urgency || "Normal"} compact={compact} />
                        <DeadlineBadge deadline={task.deadline} compact={compact} />
                    </div>
                    
                    {hasValidCreatedAt && createdAtDate && (
                        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <CalendarIcon className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
                            <span className={cn(compact ? "text-[10px]" : "text-[12px]", "font-medium")} title={format(createdAtDate, "dd MMM yyyy, HH:mm")}>
                                {format(createdAtDate, "d MMM")}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
