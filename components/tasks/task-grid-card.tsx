"use client"

import * as React from "react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn, formatProjectName } from "@/lib/utils"
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

interface TaskGridCardProps {
    task: TaskCardItem
    onOpen: (taskId: string) => void
    onComplete: (taskId: string) => void
    renderMenu?: (task: TaskCardItem) => React.ReactNode
    isSelected?: boolean
    onSelect?: (taskId: string) => void
    className?: string
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

function PriorityBadge({ urgency }: { urgency: string }) {
    const normalizedUrgency = normalizeTaskUrgency(urgency)

    if (normalizedUrgency === "Urgent") {
        return (
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-md text-[11px] font-black uppercase tracking-tight bg-[#F84444] text-white shadow-sm">
                URGENT
            </span>
        )
    }
    if (normalizedUrgency === "Idea") {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-sky-50 text-sky-600 border border-sky-200">
                <Lightbulb className="h-3.5 w-3.5" />
                Idea
            </span>
        )
    }
    return null
}

function DeadlineBadge({ deadline }: { deadline: string | Date | null | undefined }) {
    if (!deadline) return null
    const date = new Date(deadline)
    if (Number.isNaN(date.getTime())) return null

    const label = format(date, "d MMMM").toUpperCase()
    const overdue = isBefore(date, startOfDay(new Date()))

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight",
                overdue
                    ? "bg-rose-100 text-rose-700"
                    : "bg-rose-50 text-rose-500"
            )}
        >
            {label}
        </span>
    )
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    renderMenu,
    isSelected,
    className,
}: TaskGridCardProps) {
    const { timerState, startTimer, stopTimer, pauseTimer, resumeTimer } = useTimer()

    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const isPaused = isActiveTimerThisTask && !timerState.isRunning && timerState.elapsedSeconds > 0

    const services = task.project?.services || []
    const isRecurring = services.some((s: TaskCardService) => s.isRecurring)
    const projectFullName = task.project ? formatProjectName(task.project) : "No Project"
    const createdAtDate = task.createdAt ? new Date(task.createdAt) : null
    const hasValidCreatedAt = createdAtDate !== null && !Number.isNaN(createdAtDate.getTime())
    const isOverdue = task.deadline ? isBefore(new Date(task.deadline), startOfDay(new Date())) : false

    return (
        <div
            className={cn(
                "group relative rounded-3xl border bg-white cursor-pointer transition-all duration-200 h-full",
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

            <div className="p-4 flex flex-col gap-3">
                {/* Header row: title + options menu */}
                <div className="flex items-start justify-between gap-3">
                    <h4 className={cn(
                        "text-[16px] font-bold leading-tight text-slate-900 line-clamp-2 flex-1 pt-0.5",
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
                                    className="h-8 w-8 rounded-xl text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-colors"
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
                <div className="flex items-center gap-1.5 min-w-0">
                    {isRecurring
                        ? <RefreshCcw className="h-3 w-3 text-slate-400 shrink-0" />
                        : <Circle className="h-3 w-3 text-slate-400 shrink-0" />
                    }
                    <p className="min-w-0 text-[12px] font-medium text-slate-400 line-clamp-2 leading-snug tracking-tight">
                        {projectFullName}
                    </p>
                </div>

                {/* Badges: priority + deadline + absolute date */}
                <div className="flex items-end justify-between mt-auto pt-2">
                    <div className="flex items-center gap-2">
                        <PriorityBadge urgency={task.urgency || "Normal"} />
                        <DeadlineBadge deadline={task.deadline} />
                    </div>
                    
                    {hasValidCreatedAt && createdAtDate && (
                        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span
                                className="text-[11px] font-medium"
                                title={format(createdAtDate, "dd MMM yyyy, HH:mm")}
                            >
                                {format(createdAtDate, "d MMM")}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
