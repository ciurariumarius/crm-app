"use client"

import { formatProjectName } from "@/lib/utils"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format, isToday, isYesterday } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Clock, Briefcase, CheckSquare, Play, Trash2, X, AlertCircle, Copy, Square, PenLine, Timer } from "lucide-react"

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
    projects: any[]
    tasks: any[]
}

import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { useState, useMemo, useRef, useEffect, Fragment } from "react"
import { cn } from "@/lib/utils"

import { stopTimer, deleteTimeLogs, updateTimeLog, startTimer } from "@/lib/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export function TimeLogsTable({ logs, projects, tasks }: TimeLogsTableProps) {
    const [selectedLog, setSelectedLog] = useState<TimeLogWithDetails | null>(null)
    const [isStopping, setIsStopping] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
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
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsStopping(null)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === logs.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(logs.map(log => log.id))
        }
    }

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} time entries?`)) return

        setIsDeleting(true)
        try {
            const result = await deleteTimeLogs(selectedIds)
            if (result.success) {
                toast.success(`${selectedIds.length} entries deleted`)
                setSelectedIds([])
                router.refresh()
            } else {
                toast.error(result.error || "Failed to delete entries")
            }
        } catch (error) {
            toast.error("Operation failed")
        } finally {
            setIsDeleting(false)
        }
    }

    const formatDuration = (seconds: number | null) => {
        if (seconds === null) return "-"
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
        } catch (error) {
            toast.error("Failed to start timer")
        }
    }

    // Since I cannot import startTimer inside the component easily if I didn't verify it was exported correctly to be used here.
    // I see `stopTimer` is imported. I will add `startTimer` and `updateTimeLog` to imports.

    return (
        <div className="relative">
            {/* Bulk Actions Toolbar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-4 px-6 py-3 bg-foreground text-background rounded-full shadow-2xl border border-white/10 ring-1 ring-black/10">
                        <span className="text-sm font-bold flex items-center gap-2">
                            <span className="bg-background/20 px-2 py-0.5 rounded-full text-xs">
                                {selectedIds.length}
                            </span>
                            Selected
                        </span>
                        <div className="h-4 w-px bg-white/20" />
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 gap-2 font-bold transition-colors"
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-white/60 hover:text-white hover:bg-white/10 gap-2 font-bold transition-colors"
                                onClick={() => setSelectedIds([])}
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[40px] pl-4">
                                    <Checkbox
                                        checked={selectedIds.length === logs.length && logs.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="w-[120px] font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Time</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Context</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Description</TableHead>
                                <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground pr-8">Duration</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center items-center justify-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-4 py-12">
                                            <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
                                                <Clock className="h-8 w-8 opacity-20" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <p className="font-bold text-foreground">No time logs found</p>
                                                <p className="text-sm">Start a timer or log time manually to see entries here.</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedDates.map(dateKey => (
                                    <Fragment key={dateKey}>
                                        {/* Date Header */}
                                        <TableRow key={dateKey} className="bg-muted/50 hover:bg-muted/50 sticky top-0 z-10 backdrop-blur-sm supports-[backdrop-filter]:bg-muted/40">
                                            <TableCell colSpan={6} className="py-2 px-4 shadow-sm border-b border-border/60">
                                                <span className="font-bold text-xs uppercase tracking-wider text-foreground/80">
                                                    {isToday(new Date(dateKey)) ? "Today" : isYesterday(new Date(dateKey)) ? "Yesterday" : format(new Date(dateKey), "MMM d, yyyy")}
                                                </span>
                                            </TableCell>
                                        </TableRow>

                                        {/* Rows for this date */}
                                        {groupedLogs[dateKey].map((log) => {
                                            const isSelected = selectedIds.includes(log.id)
                                            const isRunning = !log.endTime

                                            return (
                                                <TableRow
                                                    key={log.id}
                                                    className={cn(
                                                        "cursor-pointer transition-all duration-200 group border-b border-border/50",
                                                        isSelected ? "bg-primary/[0.03] select-none" : "hover:bg-muted/20",
                                                        // Alternating row style could be added here if desired via css nth-child
                                                    )}
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    {/* Checkbox */}
                                                    <TableCell className="pl-4 w-[40px]" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => {
                                                                setSelectedIds(prev =>
                                                                    prev.includes(log.id) ? prev.filter(i => i !== log.id) : [...prev, log.id]
                                                                )
                                                            }}
                                                        />
                                                    </TableCell>

                                                    {/* Time Range (Monospaced) */}
                                                    <TableCell className="w-[140px] font-mono text-xs text-muted-foreground">
                                                        {format(new Date(log.startTime), "HH:mm")} — {log.endTime ? format(new Date(log.endTime), "HH:mm") : "..."}
                                                    </TableCell>

                                                    {/* Context (Project + Task) */}
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-sm text-blue-600 hover:underline dark:text-blue-400 transition-colors" title={formatProjectName(log.project)}>
                                                                {formatProjectName(log.project)}
                                                            </span>
                                                            {log.task ? (
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                                                    <CheckSquare className="h-3 w-3 opacity-70" />
                                                                    <span className="truncate max-w-[250px]">{log.task.name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">No task</span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Description - Editable */}
                                                    <TableCell className="max-w-[300px]" title={log.description || ""} onClick={(e) => e.stopPropagation()}>
                                                        <InlineTextEdit
                                                            value={log.description || ""}
                                                            logId={log.id}
                                                            placeholder="—"
                                                        />
                                                    </TableCell>

                                                    {/* Duration & Source */}
                                                    <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-3">
                                                            {/* Source Indicator */}
                                                            <div className={cn(
                                                                "h-1.5 w-1.5 rounded-full shrink-0",
                                                                log.source === "TIMER" ? "bg-emerald-400" : "bg-slate-300"
                                                            )} title={log.source === "TIMER" ? "Tracked via Timer" : "Manually Logged"} />

                                                            {/* Duration - Editable if not running */}
                                                            <div className={cn(
                                                                "font-mono text-sm font-bold tracking-tight min-w-[60px]",
                                                                isRunning ? "text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-2" : "text-foreground"
                                                            )}>
                                                                {isRunning ? (
                                                                    <>
                                                                        <span className="relative flex h-2 w-2">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                        </span>
                                                                        Running
                                                                    </>
                                                                ) : (
                                                                    <InlineDurationEdit
                                                                        seconds={log.durationSeconds}
                                                                        logId={log.id}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Quick Actions (On Hover) */}
                                                    <TableCell className="w-[50px]">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {isRunning ? (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                                    onClick={(e) => handleStopTimer(e, log.id)}
                                                                    disabled={isStopping === log.id}
                                                                    title="Stop Timer"
                                                                >
                                                                    <Square className="h-3.5 w-3.5 fill-current" />
                                                                </Button>
                                                            ) : (
                                                                // Resume / Duplicate (Simulated for now as it requires startTimer import which I will fix in next step)
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                                                                    onClick={(e) => handleResume(e, log)}
                                                                    title="Resume Timer"
                                                                >
                                                                    <Play className="h-3.5 w-3.5 fill-current" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
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

// Inline Edit Components
function InlineTextEdit({ value, logId, placeholder }: { value: string, logId: string, placeholder?: string }) {
    const [isEditing, setIsEditing] = useState(false)
    const [localValue, setLocalValue] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isEditing])

    const handleSave = async () => {
        if (localValue !== value) {
            try {
                await updateTimeLog(logId, { description: localValue })
                toast.success("Description updated")
            } catch {
                toast.error("Failed to update")
                setLocalValue(value)
            }
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') {
            setLocalValue(value)
            setIsEditing(false)
        }
    }

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm px-2 py-0 border-primary/50"
            />
        )
    }

    return (
        <div
            className="group/desc flex items-center gap-2 cursor-text min-h-[20px]"
            onClick={() => setIsEditing(true)}
        >
            {localValue ? (
                <span className="text-sm text-foreground/80 truncate block hover:text-foreground">{localValue}</span>
            ) : (
                <span className="text-muted-foreground/30 font-light text-center w-8 group-hover/desc:hidden">{placeholder}</span>
            )}
            <PenLine className="h-3 w-3 text-muted-foreground opacity-0 group-hover/desc:opacity-50 transition-opacity" />
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
