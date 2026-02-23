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
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Trash2, Loader2, Globe, Users, Target, X, Plus } from "lucide-react"
import { updateTask, deleteTask } from "@/lib/actions"
import { toast } from "sonner"
import { cn, formatProjectName } from "@/lib/utils"
import { useTimer } from "@/components/providers/timer-provider"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

interface TaskDetailsProps {
    task: any
    open: boolean
    onOpenChange: (open: boolean) => void
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
    }, [task])

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
        }, 1000)

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

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="sm:max-w-[700px] w-full p-0 flex flex-col border-none shadow-2xl focus-visible:outline-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
                showCloseButton={false}
            >
                <SheetHeader className="p-8 border-b bg-muted/20 relative">
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
                    <div className="space-y-4 pr-12">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 leading-relaxed">
                            <Link
                                href={`/vault/${task.project.site.partner.id}`}
                                className="flex items-center gap-1.5 hover:text-primary transition-colors bg-muted/40 px-2.5 py-1 rounded-md"
                            >
                                <Users className="h-3 w-3" />
                                {task.project.site.partner.name}
                            </Link>
                            <span className="opacity-30 text-xs">/</span>
                            <Link
                                href={`/vault/${task.project.site.partner.id}/${task.project.site.id}`}
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/80 tracking-widest leading-none w-fit px-1 py-1.5 rounded-lg border border-transparent hover:bg-muted/60 transition-colors"
                            >
                                <Target className="h-3.5 w-3.5 text-primary/60" />
                                <span className="opacity-90">
                                    {(task.project.site?.domainName || task.project.siteName)}
                                    {" - "}
                                    {task.project.services && task.project.services.length > 0
                                        ? task.project.services.map((s: any) => s.serviceName).join(" + ")
                                        : "General Operations"}
                                    {" - "}
                                    {format(new Date(task.project.createdAt), "MMMM yyyy")}
                                </span>
                            </Link>
                        </div>
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
                                        className="text-2xl md:text-3xl font-black tracking-tight border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto min-h-[40px] resize-none leading-tight overflow-hidden pr-24"
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
                                    <div className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                        Unsaved Name Change
                                    </div>
                                )}
                            </div>
                        </SheetTitle>

                        <div className="flex flex-col gap-4 pt-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <Select value={status} onValueChange={(val) => setStatus(val)}>
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] border-none transition-all shadow-none focus:ring-1 p-0 px-4 rounded-full text-[10px] font-black tracking-widest uppercase [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        status === "Active" ? "bg-blue-600 text-white hover:bg-blue-700" :
                                            status === "Paused" ? "bg-orange-500 text-white hover:bg-orange-600" :
                                                "bg-emerald-600 text-white hover:bg-emerald-700"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active" className="text-xs font-bold">ACTIVE</SelectItem>
                                        <SelectItem value="Paused" className="text-xs font-bold">PAUSED</SelectItem>
                                        <SelectItem value="Completed" className="text-xs font-bold">COMPLETED</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={urgency} onValueChange={(val) => setUrgency(val)}>
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] border-none shadow-none focus:ring-1 transition-all p-0 px-4 rounded-full text-[10px] font-black tracking-widest uppercase [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        urgency === "Urgent" ? "bg-rose-600 text-white hover:bg-rose-700" :
                                            urgency === "Idea" ? "bg-indigo-600 text-white hover:bg-indigo-700" :
                                                "bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Normal" className="text-xs font-bold">NORMAL</SelectItem>
                                        <SelectItem value="Urgent" className="text-xs font-bold text-rose-600">URGENT</SelectItem>
                                        <SelectItem value="Idea" className="text-xs font-bold text-indigo-600">IDEA</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Time Worked Badge */}
                                {(() => {
                                    const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
                                    const currentTimerDuration = timerState.taskId === task.id ? timerState.elapsedSeconds : 0
                                    const totalSeconds = logsDuration + currentTimerDuration
                                    const hasTimeLogs = totalSeconds > 0
                                    const useFallback = task.isCompleted && !hasTimeLogs && task.estimatedMinutes

                                    if (!hasTimeLogs && !useFallback) return null

                                    const displaySeconds = useFallback ? (task.estimatedMinutes * 60) : totalSeconds
                                    const hours = Math.floor(displaySeconds / 3600)
                                    const mins = Math.floor((displaySeconds % 3600) / 60)

                                    return (
                                        <div className={cn(
                                            "flex items-center gap-2 h-9 text-[10px] font-black tracking-widest px-4 rounded-full border animate-in fade-in zoom-in duration-300",
                                            useFallback
                                                ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                                : (timerState.taskId === task.id && timerState.isRunning ? "bg-primary text-primary-foreground border-primary/20 animate-pulse shadow-lg shadow-primary/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20")
                                        )}>
                                            <Clock className="h-3 w-3" strokeWidth={3} />
                                            <span>{hours}H {mins}M {useFallback ? "EST" : "WORKED"}</span>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-10">
                    <Separator className="bg-muted/10 mb-10" />
                    {/* Status & Deadline Row */}


                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deadline Tracking</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-bold h-12 text-sm bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20",
                                            !deadline && "text-muted-foreground/40"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deadline ? format(deadline, "PPP") : <span>Set Deadline</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimated Time (min)</label>
                            <Input
                                type="number"
                                placeholder="ex. 60"
                                value={estimatedMinutes}
                                onChange={(e) => setEstimatedMinutes(e.target.value)}
                                className="h-12 text-sm font-bold bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description / Technical Notes</label>
                        </div>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Add details, technical requirements, or SOP references..."
                        />
                    </div>

                    <div className="flex items-center justify-start pt-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-12 px-6 font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete Task
                        </Button>
                    </div>
                </div>

                <div className="p-8 border-t bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Creation Date</div>
                            <div className="text-sm font-bold">{format(new Date(task.createdAt), "MMMM do, yyyy")}</div>
                        </div>
                    </div>
                    <div className="text-[10px] font-mono font-medium text-muted-foreground opacity-40 italic text-right">
                        Ref ID: {task.id.slice(0, 8)}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
