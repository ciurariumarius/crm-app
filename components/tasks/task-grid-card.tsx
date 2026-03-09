"use client"

import * as React from "react"
import { format, isToday, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import {
    Target,
    Play,
    Pause,
    CheckCircle2,
    History,
    Lightbulb,
    Calendar as CalendarIcon
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"

interface TaskGridCardProps {
    task: any
    onOpen: (task: any) => void
    onComplete: (taskId: string) => void
    renderMenu?: (task: any) => React.ReactNode
    isSelected?: boolean
    onSelect?: (taskId: string) => void
    showActions?: boolean
    className?: string
}

export function TaskGridCard({
    task,
    onOpen,
    onComplete,
    renderMenu,
    isSelected,
    showActions = true,
    className
}: TaskGridCardProps) {
    const { timerState, startTimer, pauseTimer, resumeTimer } = useTimer()

    const getDeadlineText = (date: Date) => {
        if (isPast(date) && !isToday(date)) return "Overdue"
        if (isToday(date)) return "Today"
        return format(date, "MMM d")
    }

    const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
    const isActiveTimerThisTask = timerState.taskId === task.id
    const isRunning = isActiveTimerThisTask && timerState.isRunning
    const isPaused = isActiveTimerThisTask && !timerState.isRunning && timerState.elapsedSeconds > 0
    const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
    const totalSeconds = logsDuration + currentTimerDuration

    const formattedTotalTime = (() => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    })()

    const domainName = task.project?.site?.domainName || task.project?.name || "No Project"
    const services = task.project?.services || []
    const isRecurring = services.some((s: any) => s.isRecurring)
    const serviceName = services.length > 0
        ? services.map((s: any) => s.serviceName).join(" + ")
        : "No Service"

    const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline))
    const isDueToday = task.deadline && isToday(new Date(task.deadline))
    const estimatedSeconds = task.estimatedMinutes ? task.estimatedMinutes * 60 : 0
    const progressPercent = task.status === "Completed"
        ? 100
        : estimatedSeconds > 0
            ? Math.min(100, Math.round((totalSeconds / estimatedSeconds) * 100))
            : isRunning
                ? 45
                : 15

    return (
        <div
            className={cn(
                "cockpit-task-card group relative flex min-h-[220px] cursor-pointer flex-col p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                isSelected ? "ring-2 ring-primary/20 border-primary bg-primary/5" : "",
                className
            )}
            style={{ "--progress-width": `${progressPercent}%` } as React.CSSProperties}
            onClick={() => onOpen(task)}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <h4
                    className={cn(
                        "text-[14px] font-semibold leading-tight transition-colors text-foreground line-clamp-2 pr-3",
                        task.status === "Completed" && "line-through opacity-60"
                    )}
                >
                    {task.name}
                </h4>
                <div className="shrink-0 text-right">
                    <p className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{formattedTotalTime}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">spent</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    task.status === "Active" ? "bg-blue-500" :
                        task.status === "Paused" ? "bg-amber-500" :
                            task.status === "Completed" ? "bg-emerald-500" : "bg-muted-foreground"
                )} />
                {task.urgency === "Urgent" && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg border-none shadow-sm shadow-rose-500/10">
                        URGENT
                    </Badge>
                )}
                {task.urgency === "Idea" && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-50 rounded-lg border-sky-100 border shadow-none">
                        <Lightbulb className="h-3 w-3 mr-1" /> IDEA
                    </Badge>
                )}
                {task.deadline && (
                    <div className={cn(
                        "text-[10px] flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg border transition-colors",
                        isOverdue ? "bg-rose-50 text-rose-600 border-rose-100" :
                            isDueToday ? "bg-orange-50 text-orange-600 border-orange-100" :
                                "bg-muted/30 text-muted-foreground/70 border-border/40"
                    )}>
                        <CalendarIcon className="h-3 w-3" />
                        {getDeadlineText(new Date(task.deadline))}
                    </div>
                )}
                {renderMenu && (
                    <div className="ml-auto shrink-0" onClick={e => e.stopPropagation()}>
                        {renderMenu(task)}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 mb-4">
                <span className="text-xs font-semibold text-blue-600 truncate">
                    {domainName}
                </span>
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[11px] font-medium text-muted-foreground/70 truncate">
                        {serviceName}
                    </span>
                    {isRecurring && task.project?.createdAt && (
                        <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-[10px] font-bold text-muted-foreground shrink-0 border border-border/40">
                            {format(new Date(task.project.createdAt), "MMM yyyy")}
                        </span>
                    )}
                </div>
            </div>

            {task.description && (
                <p className="text-[11px] text-muted-foreground/50 line-clamp-2 mb-4 leading-relaxed">
                    {task.description}
                </p>
            )}

            <div className="flex-1" />

            <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-auto">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-foreground tabular-nums">
                            <History className={cn("h-3 w-3", isRunning ? "text-blue-600 timer-pulse" : "text-muted-foreground/40")} />
                            {formattedTotalTime}
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">Spent</span>
                    </div>

                    {task.estimatedMinutes && (
                        <div className="w-[1px] h-6 bg-border/40" />
                    )}
                    {task.estimatedMinutes && (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-muted-foreground/60 tabular-nums">
                                <Target className="h-3 w-3 opacity-40" />
                                {task.estimatedMinutes}m
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">Est</span>
                        </div>
                    )}
                </div>

                {showActions && (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {isRunning ? (
                            <Button
                                size="icon"
                                className="h-8 w-8 text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-lg shadow-rose-500/20 transition-all"
                                onClick={(e) => {
                                    e.preventDefault()
                                    pauseTimer()
                                    toast.success("Timer paused")
                                }}
                            >
                                <Pause className="h-3.5 w-3.5 fill-current" />
                            </Button>
                        ) : isPaused ? (
                            <Button
                                size="icon"
                                className="h-8 w-8 text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-lg shadow-amber-500/20 transition-all"
                                onClick={(e) => {
                                    e.preventDefault()
                                    resumeTimer()
                                    toast.success("Timer resumed")
                                }}
                            >
                                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                onClick={(e) => {
                                    e.preventDefault()
                                    startTimer(task.projectId, task.id, task.name)
                                    toast.success("Timer started")
                                }}
                            >
                                <Play className="h-4 w-4 ml-1" />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            onClick={(e) => {
                                e.preventDefault()
                                onComplete(task.id)
                            }}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {showActions && !isRunning && (
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    <Button
                        size="icon"
                        className="pointer-events-auto h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (isPaused) {
                                resumeTimer()
                                toast.success("Timer resumed")
                            } else {
                                startTimer(task.projectId, task.id, task.name)
                                toast.success("Timer started")
                            }
                        }}
                    >
                        <Play className="h-4 w-4 ml-0.5" />
                    </Button>
                </div>
            )}

            <div className="cockpit-task-progress" />
        </div>
    )
}
