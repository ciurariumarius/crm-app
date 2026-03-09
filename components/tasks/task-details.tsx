"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Trash2, Loader2, Globe, Users, Target, X, Plus, Play, Pause, Square } from "lucide-react"
import { updateTask, deleteTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { cn, formatProjectName, formatRelativeDate } from "@/lib/utils"
import { useTimer } from "@/components/providers/timer-provider"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

interface TaskDetailsProps {
    task: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

function formatClock(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":")
}

function formatDurationLabel(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
}

export function TaskDetails({ task, open, onOpenChange }: TaskDetailsProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const [loading, setLoading] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)

    // Form state
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [status, setStatus] = React.useState("")
    const [urgency, setUrgency] = React.useState("")
    const [deadline, setDeadline] = React.useState<Date | undefined>(undefined)
    const [estimatedMinutes, setEstimatedMinutes] = React.useState<string>("")

    // Sync form state with task
    React.useEffect(() => {
        if (task) {
            setName(task.name || "")
            setDescription(task.description || "")
            setStatus(task.status || "Active")
            setUrgency(task.urgency || "Normal")
            setDeadline(task.deadline ? new Date(task.deadline) : undefined)
            setEstimatedMinutes(task.estimatedMinutes?.toString() || "")
        }
    }, [task?.id])

    const handleUpdate = async () => {
        if (!task) return
        setLoading(true)
        try {
            const result = await updateTask(task.id, {
                name,
                description,
                status,
                urgency,
                deadline,
                estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
            })

            if (result.success) {
                toast.success("Task updated")
            } else {
                toast.error(result.error || "Failed to update task")
            }
        } catch (error) {
            toast.error("Failed to update task")
        } finally {
            setLoading(false)
        }
    }

    // Auto-save logic
    const isInitialMount = React.useRef(true)
    React.useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        if (!task) return


        const timer = setTimeout(() => {
            if (
                name !== task.name ||
                description !== task.description ||
                status !== task.status ||
                urgency !== task.urgency ||
                deadline?.getTime() !== (task.deadline ? new Date(task.deadline).getTime() : undefined) ||
                (estimatedMinutes || null) !== (task.estimatedMinutes?.toString() || null)
            ) {
                handleUpdate()
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [name, description, status, urgency, deadline, estimatedMinutes])

    const handleDelete = async () => {
        if (!task) return
        setIsDeleting(true)
        try {
            const result = await deleteTask(task.id, task.projectId)
            if (result.success) {
                toast.success("Task deleted")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to delete task")
            }
        } catch (error) {
            toast.error("Failed to delete task")
        } finally {
            setIsDeleting(false)
        }
    }

    if (!task) return null
    const isActiveTimerThisTask = timerState.taskId === task.id
    const isTaskRunning = isActiveTimerThisTask && timerState.isRunning
    const isTaskPaused = isActiveTimerThisTask && !timerState.isRunning
    const loggedSeconds = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
    const runningSeconds = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
    const totalTrackedSeconds = loggedSeconds + runningSeconds
    const useEstimatedFallback = task.status === "Completed" && totalTrackedSeconds === 0 && Boolean(task.estimatedMinutes)
    const timerDisplaySeconds = useEstimatedFallback ? task.estimatedMinutes * 60 : totalTrackedSeconds
    const loggedHours = Math.floor(loggedSeconds / 3600)
    const loggedMinutes = Math.floor((loggedSeconds % 3600) / 60)
    const timerStatusLabel = isTaskRunning ? "Running" : isTaskPaused ? "Paused" : "Ready"
    const timerPrimaryLabel = isTaskRunning ? "Pause" : isTaskPaused ? "Resume" : "Start"
    const sortedTimeLogs = [...(task.timeLogs || [])].sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

    const handleTaskTimerPrimaryAction = () => {
        if (isTaskRunning) {
            void globalPauseTimer()
            return
        }

        if (isTaskPaused) {
            void globalResumeTimer()
            return
        }

        void globalStartTimer(task.projectId, task.id, task.name)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full max-w-[900px] p-0 flex flex-col border-none shadow-2xl focus-visible:outline-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                showCloseButton={false}
            >
                <SheetHeader className="p-6 border-b border-slate-200 bg-white/70 relative">
                    <div className="absolute right-6 top-6 z-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-all"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="space-y-4 pr-16">
                        <SheetTitle className="group relative">
                            <div className="space-y-4">
                                <div className="relative">
                                    <Textarea
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                if (name !== task.name) handleUpdate()
                                            }
                                            if (e.key === 'Escape') {
                                                setName(task.name || "")
                                            }
                                        }}
                                        className="text-[18px] font-semibold tracking-[-0.02em] border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto min-h-[28px] resize-none leading-tight overflow-hidden pr-24"
                                        placeholder="Task Name"
                                        rows={1}
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement
                                            target.style.height = 'auto'
                                            target.style.height = `${target.scrollHeight}px`
                                        }}
                                    />
                                    <div className="absolute right-0 top-1.2 flex items-center gap-2">
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            name !== task.name && (
                                                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                        onClick={handleUpdate}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                                        onClick={() => setName(task.name || "")}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                                {name !== task.name && (
                                    <div className="text-xs font-semibold text-primary animate-pulse">
                                        Unsaved Name Change
                                    </div>
                                )}
                            </div>
                        </SheetTitle>

                        <div className="flex flex-col gap-4 pt-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <Select value={status} onValueChange={(val) => setStatus(val)}>
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] transition-all p-0 px-4 rounded-full text-xs font-semibold border [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        status === "Active" ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]" :
                                            status === "Paused" ? "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]" :
                                                "bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active" className="text-xs font-medium">Active</SelectItem>
                                        <SelectItem value="Paused" className="text-xs font-medium">Paused</SelectItem>
                                        <SelectItem value="Completed" className="text-xs font-medium">Completed</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={urgency} onValueChange={(val) => setUrgency(val)}>
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] transition-all p-0 px-4 rounded-full text-xs font-semibold border [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        urgency === "Urgent" ? "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]" :
                                            urgency === "Idea" ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]" :
                                                "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Urgent" className="text-xs font-medium text-rose-600">Urgent</SelectItem>
                                        <SelectItem value="Normal" className="text-xs font-medium">Normal</SelectItem>
                                        <SelectItem value="Idea" className="text-xs font-medium text-sky-600">Idea</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-10">
                    <Separator className="bg-muted/10 mb-10" />
                    {/* Status & Deadline Row */}


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-muted-foreground/80">Deadline Tracking</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-bold h-12 text-sm bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20 rounded-xl",
                                            !deadline && "text-muted-foreground/40"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deadline ? format(deadline, "PPP") : <span>Set Deadline</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-xl pointer-events-auto" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={deadline}
                                        onSelect={setDeadline}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-muted-foreground/80">Estimated Time (min)</label>
                            <Input
                                type="number"
                                placeholder="ex. 60"
                                value={estimatedMinutes}
                                onChange={(e) => setEstimatedMinutes(e.target.value)}
                                className="h-12 text-sm font-bold bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground/80">Description / Technical Notes</label>
                        </div>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Add details, technical requirements, or SOP references..."
                            uploadProjectId={task?.projectId || task?.id}
                        />
                    </div>

                    <div className="flex items-center justify-start pt-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-12 px-6 font-semibold text-sm gap-2 rounded-xl"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete Task
                        </Button>
                    </div>

                    <section className="space-y-4 pt-8">
                        <Separator className="bg-muted/10" />

                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                Task Time Tracker
                            </h4>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-2xl font-bold leading-none text-slate-900 tabular-nums">
                                                {formatClock(timerDisplaySeconds)}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-[0.04em]",
                                                isTaskRunning ? "text-[#10B981]" : isTaskPaused ? "text-[#D97706]" : "text-slate-400"
                                            )}>
                                                {timerStatusLabel}
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "mt-1 text-[11px] font-medium",
                                            useEstimatedFallback ? "text-[#D97706]" : "text-slate-500"
                                        )}>
                                            {useEstimatedFallback ? "Estimated from completed task" : `${loggedHours}h ${loggedMinutes}m logged`}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleTaskTimerPrimaryAction()
                                            }}
                                            className={cn(
                                                "h-8 rounded-lg px-3 text-xs font-semibold transition-all active:scale-[0.98]",
                                                isTaskRunning
                                                    ? "bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7]"
                                                    : "bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"
                                            )}
                                        >
                                            {isTaskRunning ? (
                                                <Pause className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                            ) : (
                                                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                            )}
                                            {timerPrimaryLabel}
                                        </Button>

                                        <Button
                                            type="button"
                                            size="icon"
                                            disabled={!isActiveTimerThisTask}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                void globalStopTimer()
                                            }}
                                            className="h-8 w-8 rounded-lg bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E8] disabled:bg-slate-100 disabled:text-slate-300"
                                        >
                                            <Square className="h-3.5 w-3.5 fill-current" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-muted-foreground/80 flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    Time Logs History
                                </h4>
                                <div className="text-xs font-medium text-muted-foreground/60">
                                    {sortedTimeLogs.length} Sessions
                                </div>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {sortedTimeLogs.length === 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
                                        No time logs recorded for this task yet.
                                    </div>
                                )}

                                {sortedTimeLogs.map((log: any) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-foreground">
                                                {formatRelativeDate(log.startTime)}
                                            </span>
                                            <span className="text-xs font-medium text-muted-foreground/60">
                                                {format(new Date(log.startTime), "HH:mm")} - {log.endTime ? format(new Date(log.endTime), "HH:mm") : "Ongoing"}
                                            </span>
                                            {log.notes && (
                                                <span className="text-xs text-muted-foreground italic mt-1 max-w-[200px] truncate">
                                                    {log.notes}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-foreground tabular-nums">
                                            {formatDurationLabel(log.durationSeconds || 0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-8 border-t bg-muted/20 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground/80">Creation Date</div>
                            <div className="text-sm font-bold">{formatRelativeDate(task.createdAt)}</div>
                        </div>
                    </div>
                    <div className="text-xs font-mono font-medium text-muted-foreground opacity-40 italic text-right">
                        Ref ID: {task.id.slice(0, 8)}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
