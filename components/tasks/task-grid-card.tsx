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
    task: any
    onOpen: (taskId: string) => void
    onComplete: (taskId: string) => void
    renderMenu?: (task: any) => React.ReactNode
    isSelected?: boolean
    onSelect?: (taskId: string) => void
    className?: string
}

function PriorityBadge({ urgency }: { urgency: string }) {
    const normalizedUrgency = normalizeTaskUrgency(urgency)

    if (normalizedUrgency === "Urgent") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.08em] bg-rose-50 text-rose-600 border border-rose-200">
                <AlertTriangle className="h-2.5 w-2.5" />
                Urgent
            </span>
        )
    }
    if (normalizedUrgency === "Idea") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.08em] bg-sky-50 text-sky-600 border border-sky-200">
                <Lightbulb className="h-2.5 w-2.5" />
                Idea
            </span>
        )
    }
    return null
}

function DeadlineBadge({ deadline }: { deadline: string | null | undefined }) {
    if (!deadline) return null
    const date = new Date(deadline)
    if (Number.isNaN(date.getTime())) return null
    const overdue = isPast(date) && !isToday(date)
    const dueToday = isToday(date)

    const label = dueToday ? "Today" : format(date, "d MMMM")

    return (
        <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-[0.08em] border",
            overdue
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : dueToday
                    ? "bg-orange-50 text-orange-600 border-orange-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
        )}>
            {overdue ? <AlertTriangle className="h-2.5 w-2.5" /> : <CalendarIcon className="h-2.5 w-2.5" />}
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

    const domainName = task.project?.site?.domainName || task.project?.name || "No Project"
    const services = task.project?.services || []
    const isRecurring = services.some((s: any) => s.isRecurring)
    const serviceName = services.length > 0
        ? services.map((s: any) => s.serviceName).join(" + ")
        : null

    const projectFullName = serviceName ? `${domainName} — ${serviceName}` : domainName

    return (
        <div
            className={cn(
                "group relative rounded-2xl border bg-white cursor-pointer transition-all duration-200",
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
                        {task.name}
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
                                        startTimer(task.projectId, task.id, task.name)
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
                <div className="flex items-center gap-1.5 min-w-0 -mt-0.5">
                    {isRecurring
                        ? <RefreshCcw className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        : <Zap className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    }
                    <p className="text-[12px] font-bold text-slate-600 truncate tracking-tight">{projectFullName}</p>
                </div>

                {/* Badges: priority + deadline */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge urgency={task.urgency} />
                    <DeadlineBadge deadline={task.deadline} />
                </div>
            </div>
        </div>
    )
}
