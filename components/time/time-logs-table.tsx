"use client"

import { formatProjectName } from "@/lib/utils"
import { format, isToday, isYesterday } from "date-fns"
import { Clock, Play, Square } from "lucide-react"

interface TimeLogWithDetails {
    id: string
    description: string | null
    startTime: Date
    endTime: Date | null
    durationSeconds: number | null
    isPaused: boolean
    source: string // "MANUAL" | "TIMER"
    project: {
        id: string
        site: {
            domainName: string
        }
        services: { serviceName: string, isRecurring: boolean }[]
        createdAt: Date
    }
    task: {
        id: string
        name: string
    } | null
}

interface TimeLogsTableProps {
    logs: TimeLogWithDetails[]
    projects: Array<{ id: string; displayName: string }>
    tasks: Array<{ id: string; name: string; projectId: string }>
}

import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { useState, useMemo, Fragment } from "react"
import { cn } from "@/lib/utils"

import { stopTimer, updateTimeLog, startTimer } from "@/lib/actions/time"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { StatusChip } from "@/components/ui/status-chip"
import { ListEmptyState } from "@/components/ui/list-state"

export function TimeLogsTable({ logs, projects, tasks }: TimeLogsTableProps) {
    const [selectedLog, setSelectedLog] = useState<TimeLogWithDetails | null>(null)
    const [isStopping, setIsStopping] = useState<string | null>(null)
    const router = useRouter()

    const handleStopTimer = async (e: React.MouseEvent, logId: string) => {
        e.stopPropagation()
        setIsStopping(logId)
        try {
            const result = await stopTimer()
            if (result.success) {
                toast.success("Timer stopped")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to stop timer")
            }
        } catch {
            toast.error("Process failed")
        } finally {
            setIsStopping(null)
        }
    }

    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: { [key: string]: TimeLogWithDetails[] } = {}
        logs.forEach(log => {
            const dateKey = format(new Date(log.startTime), "yyyy-MM-dd")
            if (!groups[dateKey]) {
                groups[dateKey] = []
            }
            groups[dateKey].push(log)
        })
        return groups
    }, [logs])

    const sortedDates = Object.keys(groupedLogs).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    const handleResume = async (e: React.MouseEvent, log: TimeLogWithDetails) => {
        e.stopPropagation()
        try {
            await startTimer(log.project.id, log.task?.id)
            toast.success("Timer started")
            router.refresh()
        } catch {
            toast.error("Failed to start timer")
        }
    }

    return (
        <div className="relative">
            <div className="overflow-x-auto">
                {/* Unified Header */}
                <div className="hidden md:grid h-10 w-full items-center px-6 mb-2 text-slate-500 md:min-w-[1240px] grid-cols-[380px_350px_180px_200px_80px] gap-x-6">
                    <div className="ui-overline">Project Name</div>
                    <div className="ui-overline">Task Name</div>
                    <div className="ui-overline">Time Range</div>
                    <div className="ui-overline text-right">Total Duration</div>
                    <div className="w-full"></div>
                </div>
                

                <div className="flex flex-col gap-1 md:min-w-[1240px]">
                    {logs.length === 0 ? (
                        <ListEmptyState
                            title="No time logs discovered"
                            description="Log some time to see it in your dashboard."
                            icon={<Clock className="h-5 w-5" />}
                            className="py-14"
                        />
                    ) : (
                        sortedDates.map(dateKey => (
                            <Fragment key={dateKey}>
                                {/* Date Header (Section Title) */}
                                <div className="py-6 px-4 flex items-center gap-3 group/date transition-all duration-300">
                                    <span className="h-4 w-1 rounded-full bg-blue-500/80" />
                                    <h3 className="ui-overline text-slate-500">
                                        {isToday(new Date(dateKey)) ? "Today" : isYesterday(new Date(dateKey)) ? "Yesterday" : format(new Date(dateKey), "d MMMM yyyy")}
                                    </h3>
                                    <div className="h-px flex-1 bg-slate-100 hidden md:block opacity-50 ml-2" />
                                </div>

                                {/* Rows for this date */}
                                <div className="flex flex-col gap-2 mb-6">
                                    {groupedLogs[dateKey].map((log, rowIdx) => {
                                        const isRunning = !log.endTime

                                        return (
                                            <div
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className={cn(
                                                    "group stagger-row-enter premium-card relative grid min-h-[64px] items-center bg-white rounded-xl py-4 px-6 border border-border/60 hover:bg-slate-50 transition-all duration-300 md:grid-cols-[380px_350px_180px_200px_80px] gap-x-6 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                                )}
                                                style={{ animationDelay: `${rowIdx * 0.05}s` }}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault()
                                                        setSelectedLog(log)
                                                    }
                                                }}
                                            >
                                                {/* 1. Project */}
                                                <div className="min-w-0 pr-4">
                                                    <span className="text-[15px] font-bold tracking-tight text-slate-900 leading-tight" title={formatProjectName(log.project)}>
                                                        {formatProjectName(log.project)}
                                                    </span>
                                                </div>

                                                {/* 2. Task (Dedicated Column) */}
                                                <div className="min-w-0 pr-4">
                                                    {log.task && (
                                                        <span className="text-xs font-medium text-slate-500 leading-tight block truncate">
                                                            {log.task.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 3. Time Range */}
                                                <div className="flex flex-col justify-center">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[12px] font-mono font-bold tracking-tight text-slate-600 w-fit shadow-sm">
                                                        <span>{format(new Date(log.startTime), "HH:mm")}</span>
                                                        <span className="opacity-30">—</span>
                                                        <span>{log.endTime ? format(new Date(log.endTime), "HH:mm") : "..."}</span>
                                                    </div>
                                                </div>

                                                {/* 4. Duration & Source */}
                                                <div className="flex items-center justify-end gap-3 pr-4" onClick={(e) => e.stopPropagation()}>
                                                    {/* Source Indicator */}
                                                    <div className={cn(
                                                        "h-2 w-2 rounded-full shrink-0 shadow-sm transition-colors duration-300",
                                                        log.source === "TIMER" ? "bg-emerald-500 shadow-emerald-200" : "bg-slate-200"
                                                    )} title={log.source === "TIMER" ? "Live Tracked" : "Manually Logged"} />

                                                    {/* Duration Badge */}
                                                    <div className={cn(
                                                        "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm text-sm font-bold font-mono tracking-tight transition-all min-w-[100px] justify-center",
                                                        isRunning 
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse" 
                                                            : "bg-white text-slate-900 border-slate-200 group-hover:bg-slate-50"
                                                    )}>
                                                        {isRunning ? (
                                                            <StatusChip tone="active" size="xs">Active</StatusChip>
                                                        ) : (
                                                            <InlineDurationEdit
                                                                seconds={log.durationSeconds}
                                                                logId={log.id}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 5. Actions (Hover) */}
                                                <div className="flex items-center justify-end">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        {isRunning ? (
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-9 w-9 text-rose-500 hover:text-white hover:bg-rose-500 border-rose-100 hover:border-rose-500 transition-all rounded-xl shadow-sm"
                                                                onClick={(e) => handleStopTimer(e, log.id)}
                                                                disabled={isStopping === log.id}
                                                                title="Stop Timer"
                                                            >
                                                                <Square className="h-4 w-4 fill-current" />
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-9 w-9 text-slate-400 hover:text-white hover:bg-emerald-500 border-slate-200 hover:border-emerald-500 transition-all rounded-xl shadow-sm"
                                                                onClick={(e) => handleResume(e, log)}
                                                                title="Resume Timer"
                                                            >
                                                                <Play className="h-4 w-4 fill-current ml-0.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Fragment>
                        ))
                    )}
                </div>
            </div>

            <TimeLogSheet
                log={selectedLog}
                open={!!selectedLog}
                onOpenChange={(open) => !open && setSelectedLog(null)}
                projects={projects}
                tasks={tasks}
            />
        </div>
    )
}


function InlineDurationEdit({ seconds, logId }: { seconds: number | null, logId: string }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState("")

    const formatDuration = (secs: number | null) => {
        if (secs === null) return "-"
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = secs % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const parseDurationInput = (input: string): number | null => {
        // Formats: "1h 30m", "1.5h", "90m", "01:30:00"
        let totalSeconds = 0
        const lower = input.toLowerCase().trim()

        if (!lower) return null

        // HH:MM:SS or HH:MM
        if (lower.includes(':')) {
            const parts = lower.split(':').map(Number)
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
            if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
            return null
        }

        // 1h 30m
        const sections = lower.match(/(\d+(?:\.\d+)?)([hm])/g)
        if (sections) {
            sections.forEach(sec => {
                const val = parseFloat(sec)
                if (sec.includes('h')) totalSeconds += val * 3600
                if (sec.includes('m')) totalSeconds += val * 60
            })
            return Math.floor(totalSeconds)
        }

        // Just number -> assume minutes
        if (!isNaN(parseFloat(lower))) {
            return Math.floor(parseFloat(lower) * 60)
        }

        return null
    }

    const startEditing = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsEditing(true)
        setEditValue(formatDuration(seconds))
    }

    const handleSave = async () => {
        const newSeconds = parseDurationInput(editValue)
        if (newSeconds !== null && newSeconds !== seconds) {
            try {
                await updateTimeLog(logId, { durationSeconds: newSeconds, source: "MANUAL" })
                toast.success("Duration updated")
            } catch {
                toast.error("Failed to update")
            }
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') setIsEditing(false)
    }

    if (isEditing) {
        return (
            <Input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="h-7 w-20 text-sm px-1 py-0 font-mono text-right border-primary/50"
            />
        )
    }

    return (
        <span
            className="hover:bg-muted/50 px-1 py-0.5 rounded cursor-text transition-colors"
            onClick={startEditing}
        >
            {formatDuration(seconds)}
        </span>
    )
}
