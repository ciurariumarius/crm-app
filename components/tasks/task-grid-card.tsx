"use client"

import * as React from "react"
import { format, isToday, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import {
    AlertTriangle,
    Calendar as CalendarIcon,
    CheckCheck,
    Lightbulb,
    MoreHorizontal,
    Pause,
    Play,
    RefreshCcw,
    Square,
    Zap,
    ArrowUpRight,
    Clock,
    CalendarClock,
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
    project?: TaskCardProject | null
}

function PriorityBadge({ urgency }: { urgency: string }) {
    const normalizedUrgency = normalizeTaskUrgency(urgency)

    if (normalizedUrgency === "Urgent") {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#F84444] text-white shadow-sm ring-1 ring-[#F84444]">
                <AlertTriangle className="h-3.5 w-3.5 fill-white text-[#F84444]" />
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
    
    // overdue is anytime in the past
    const overdue = isPast(date)
    const dueToday = isToday(date)
    const label = dueToday ? "Today" : format(date, "d MMMM")

    if (overdue) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#FFF1F2] text-[#F84444] border border-[#FECDD3]">
                <Clock className="h-3.5 w-3.5" />
                {dueToday ? "TODAY" : label.toUpperCase()}
            </span>
        )
    }

    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-all",
            dueToday
                ? "bg-orange-500 text-white border-transparent"
                : "bg-blue-50 text-blue-600 border-blue-200"
        )}>
            {dueToday ? <CalendarClock className="h-3.5 w-3.5" /> : <CalendarIcon className="h-3.5 w-3.5" />}
            {label.toUpperCase()}
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

    const domainName = task.project?.site?.domainName || task.project?.name || "No Project"
    const services = task.project?.services || []
    const isRecurring = services.some((s: TaskCardService) => s.isRecurring)
    const serviceName = services.length > 0
        ? services.map((s: TaskCardService) => s.serviceName).filter(Boolean).join(" + ")
        : null

    const recurringMonthLabel = (() => {
        if (!isRecurring || !task.project?.createdAt) return null
        const createdDate = new Date(task.project.createdAt)
        if (Number.isNaN(createdDate.getTime())) return null
        return format(createdDate, "MMM yyyy")
    })()

    const projectFullName = serviceName ? `${domainName} — ${serviceName}` : domainName

    return (
        <div
            className={cn(
                "group relative rounded-2xl border bg-white cursor-pointer transition-all duration-200 h-full",
                "hover:shadow-[0_8px_30px_-8px_rgba(15,23,42,0.15)] hover:-translate-y-0.5",
                isRunning
                    ? "border-blue-300 bg-blue-50/30 shadow-[0_0_0_2px_rgba(37,99,235,0.15)]"
                    : isSelected
                        ? "border-primary/30 bg-primary/[0.02] shadow-[0_0_0_2px_rgba(var(--primary),0.1)]"
                        : "border-slate-200 hover:border-slate-300",
                className
            )}
            onClick={() => onOpen(task.id)}
        >
            {/* Running timer indicator */}
            {isRunning && (
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-blue-400 via-blue-500 to-violet-500 animate-pulse" />
            )}

            <div className="p-4 flex flex-col gap-3">
                {/* Header row: title + options menu */}
                <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                        "text-[14px] font-semibold leading-snug text-slate-900 line-clamp-2 flex-1",
                        task.status === "Completed" && "line-through opacity-50"
                    )}>
                        {task.name || "Untitled task"}
                    </h4>

                    {/* Options menu — always visible via ··· */}
                    <div onClick={e => e.stopPropagation()} className="shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100">
                                <DropdownMenuItem
                                    onClick={() => onOpen(task.id)}
                                    className="gap-2 text-sm font-medium cursor-pointer"
                                >
                                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                                    Open panel
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

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

                                {task.status !== "Completed" && (
                                    <DropdownMenuItem
                                        onClick={() => onComplete(task.id)}
                                        className="gap-2 text-sm font-medium cursor-pointer"
                                    >
                                        <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
                                        Mark completed
                                    </DropdownMenuItem>
                                )}

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
                <div className="flex items-start gap-1.5 min-w-0 -mt-0.5">
                    {isRecurring
                        ? <RefreshCcw className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        : <Zap className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    }
                    <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                        <p className="text-[12px] font-bold text-slate-600 tracking-tight leading-tight break-words">{projectFullName}</p>
                        {recurringMonthLabel ? (
                            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-600">
                                {recurringMonthLabel}
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Badges: priority + deadline */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge urgency={task.urgency || "Normal"} />
                    <DeadlineBadge deadline={task.deadline} />
                </div>
            </div>
        </div>
    )
}
