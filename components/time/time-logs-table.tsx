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
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Clock, Briefcase, CheckSquare } from "lucide-react"

interface TimeLogWithDetails {
    id: string
    description: string | null
    startTime: Date
    endTime: Date | null
    durationSeconds: number | null
    project: {
        id: string
        site: {
            domainName: string
        }
        services: { serviceName: string, isRecurring: boolean }[]
        createdAt: Date
    }
    task: {
        name: string
    } | null
}

interface TimeLogsTableProps {
    logs: TimeLogWithDetails[]
    projects: any[]
    tasks: any[]
}

import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { useState } from "react"
import { cn } from "@/lib/utils"

import { stopTimer, deleteTimeLog, deleteTimeLogs } from "@/lib/actions"
import { toast } from "sonner"
import { Square, Trash2, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"

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

    const toggleSelect = (e: React.MouseEvent | React.FocusEvent, id: string) => {
        e.stopPropagation()
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
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
        if (!seconds) return "-"
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return `${hours}h ${minutes}m`
    }

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
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px] pl-4">
                                <Checkbox
                                    checked={selectedIds.length === logs.length && logs.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all"
                                />
                            </TableHead>
                            <TableHead className="w-[120px] font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Date</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Project</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Task</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Description</TableHead>
                            <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground pr-8">Duration</TableHead>
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
                            logs.map((log) => {
                                const isSelected = selectedIds.includes(log.id)
                                return (
                                    <TableRow
                                        key={log.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-200 group border-b border-border/50",
                                            isSelected ? "bg-primary/[0.03] select-none" : "hover:bg-muted/50"
                                        )}
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {
                                                    setSelectedIds(prev =>
                                                        prev.includes(log.id) ? prev.filter(i => i !== log.id) : [...prev, log.id]
                                                    )
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{format(new Date(log.startTime), "MMM d, yyyy")}</span>
                                                <span className="text-[10px] text-muted-foreground opacity-60">
                                                    {format(new Date(log.startTime), "HH:mm")}
                                                    {log.endTime && ` - ${format(new Date(log.endTime), "HH:mm")}`}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                                                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                                <span className="font-semibold text-sm truncate max-w-[150px] block" title={formatProjectName(log.project)}>
                                                    {formatProjectName(log.project)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {log.task ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-muted hover:bg-muted text-foreground flex w-fit items-center gap-1.5 font-bold text-[10px] px-2 py-0.5 rounded-md max-w-[150px]"
                                                >
                                                    <CheckSquare className="h-3 w-3 opacity-60 shrink-0" />
                                                    <span className="truncate" title={log.task.name}>{log.task.name}</span>
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic opacity-50">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-sm" title={log.description || ""}>
                                            {log.description ? (
                                                <span className="text-foreground/80">{log.description}</span>
                                            ) : (
                                                <span className="text-muted-foreground italic opacity-40 text-xs text-center block w-full">no description</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex flex-col items-end">
                                                <div className={cn(
                                                    "flex items-center gap-2 font-mono text-sm font-bold",
                                                    !log.endTime ? "text-emerald-500" : "text-foreground"
                                                )}>
                                                    {!log.endTime && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                    {log.endTime ? formatDuration(log.durationSeconds) : "RUNNING"}
                                                </div>
                                                {!log.endTime && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-rose-500 p-0 hover:bg-rose-500/10 mt-1"
                                                        onClick={(e) => handleStopTimer(e, log.id)}
                                                        disabled={isStopping === log.id}
                                                    >
                                                        <Square className="h-3 w-3 fill-current" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
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
