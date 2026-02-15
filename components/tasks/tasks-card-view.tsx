"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { updateTask, toggleTaskStatus, deleteTasks, updateTasksStatus } from "@/lib/actions"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Users, Globe, Trash2, CheckCircle2, MoreVertical, Briefcase } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"

import { startTimer, stopTimer, pauseTimer, resumeTimer } from "@/lib/actions"
import { Play, Square, Pause } from "lucide-react"

interface TasksCardViewProps {
    tasks: any[]
    allServices: any[]
    initialActiveTimer?: any
}

export function TasksCardView({ tasks, allServices, initialActiveTimer }: TasksCardViewProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const [selectedSite, setSelectedSite] = React.useState<any>(null)
    const [selectedTask, setSelectedTask] = React.useState<any>(null)
    const [quickLogTask, setQuickLogTask] = React.useState<any>(null) // New state for quick log
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isBulkOperating, setIsBulkOperating] = React.useState(false)
    const [activeTimer, setActiveTimer] = React.useState<any>(initialActiveTimer)
    const [timerDuration, setTimerDuration] = React.useState(0)

    React.useEffect(() => {
        // If we have a local optimistic timer ("temp"), don't overwrite it with initialProps
        if (activeTimer?.id === "temp") return

        // Sync with server state
        if (initialActiveTimer) {
            // If we have a running or paused timer from server, use it
            // We trust the server state more than local optimistic one if server provides one
            setActiveTimer(initialActiveTimer)
        } else {
            // Server says no timer.
            // If local timer is 'temp' (optimistic start), we keep it until server confirms or error.
            if (activeTimer?.id !== 'temp') {
                setActiveTimer(null)
            }
        }
    }, [initialActiveTimer])

    React.useEffect(() => {
        if (!activeTimer || activeTimer.status === 'paused') {
            setTimerDuration(0)
            return
        }

        const calculateDuration = () => {
            const start = new Date(activeTimer.startTime).getTime()
            const now = new Date().getTime()
            return Math.floor((now - start) / 1000)
        }

        setTimerDuration(calculateDuration())

        const interval = setInterval(() => {
            setTimerDuration(calculateDuration())
        }, 1000)

        return () => clearInterval(interval)
    }, [activeTimer])

    const handleStartTimer = async (task: any) => {
        if (activeTimer?.status === 'running') {
            await handleStopTimer()
        }

        // Optimistic
        const tempTimer = {
            id: 'temp',
            startTime: new Date(),
            taskId: task.id,
            projectId: task.projectId,
            status: 'running',
            task: { name: task.name }
        }
        setActiveTimer(tempTimer)

        try {
            const result = await startTimer(task.projectId, task.id)
            if (result.success) {
                toast.success("Timer started")
                setActiveTimer({ ...result.data, status: 'running' })
            } else {
                toast.error(result.error || "Failed to start timer")
                setActiveTimer(null)
            }
        } catch (error) {
            toast.error("Failed to start timer")
            setActiveTimer(null)
        }
    }

    const handleStopTimer = async () => {
        const prevTimer = activeTimer
        setActiveTimer(null)

        try {
            const result = await stopTimer()
            if (result.success) {
                toast.success("Timer stopped")
            } else {
                toast.error(result.error || "Failed to stop timer")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to stop timer")
            setActiveTimer(prevTimer)
        }
    }

    const handlePauseTimer = async () => {
        const prevTimer = activeTimer
        // Optimistic
        if (activeTimer) {
            setActiveTimer({ ...activeTimer, status: 'paused' })
        }

        try {
            const result = await pauseTimer()
            if (result.success) {
                toast.success("Timer paused")
            } else {
                toast.error(result.error || "Failed to pause")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to pause timer")
            setActiveTimer(prevTimer)
        }
    }

    const handleResumeTimer = async () => {
        const prevTimer = activeTimer
        // Optimistic (approximation of start time)
        if (activeTimer) {
            setActiveTimer({ ...activeTimer, status: 'running', startTime: new Date() })
        }

        try {
            const result = await resumeTimer()
            if (result.success) {
                toast.success("Timer resumed")
                setActiveTimer({ ...result.data, status: 'running' })
            } else {
                toast.error(result.error || "Failed to resume")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to resume timer")
            setActiveTimer(prevTimer)
        }
    }

    const formatTimer = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }


    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} tasks?`)) return
        setIsBulkOperating(true)
        try {
            const result = await deleteTasks(selectedIds)
            if (result.success) {
                toast.success("Tasks deleted")
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to delete tasks")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleBulkStatusUpdate = async (status: string) => {
        setIsBulkOperating(true)
        try {
            const result = await updateTasksStatus(selectedIds, status)
            if (result.success) {
                toast.success(`Tasks updated to ${status}`)
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to update tasks")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleStatusUpdate = async (taskId: string, status: string) => {
        setUpdatingId(taskId)
        try {
            const result = await updateTask(taskId, { status })
            if (result.success) {
                toast.success("Status updated")
            } else {
                toast.error(result.error || "Failed to update status")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUrgencyUpdate = async (taskId: string, urgency: string) => {
        setUpdatingId(taskId)
        try {
            const result = await updateTask(taskId, { urgency })
            if (result.success) {
                toast.success("Urgency updated")
            } else {
                toast.error(result.error || "Failed to update urgency")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between p-2 pl-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-md">
                    <div className="flex items-center gap-6">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {selectedIds.length} Selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Completed")}
                                disabled={isBulkOperating}
                            >
                                Complete
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Active")}
                                disabled={isBulkOperating}
                            >
                                Activate
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/10"
                            onClick={handleBulkDelete}
                            disabled={isBulkOperating}
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                            Delete
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setSelectedIds([])}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map((task) => (
                    <Card
                        key={task.id}
                        className={cn(
                            "group relative overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/5 border-border",
                            selectedIds.includes(task.id) ? "ring-1 ring-primary/50 bg-primary/[0.02]" : "bg-card"
                        )}
                        onClick={() => setSelectedTask(task)}
                    >
                        <CardContent className="p-6">
                            {/* Selection */}
                            <div
                                className={cn(
                                    "absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
                                    selectedIds.includes(task.id) && "opacity-100"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSelect(task.id)
                                }}
                            >
                                <Checkbox
                                    checked={selectedIds.includes(task.id)}
                                    className="h-4 w-4 rounded-[4px] border-border bg-muted data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5 pl-7 flex-1 min-w-0">
                                        <h3 className={cn(
                                            "font-semibold text-[15px] leading-snug tracking-tight transition-colors group-hover:text-primary break-words",
                                            task.isCompleted && "text-muted-foreground/40"
                                        )}>
                                            {task.name}
                                        </h3>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Badge className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0 border-none shadow-none cursor-pointer",
                                                    task.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                                                        task.status === "Active" ? "bg-primary/10 text-primary" :
                                                            "bg-orange-500/10 text-orange-600"
                                                )}>
                                                    {task.status}
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-popover border-border">
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Active")}>Active</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Paused")}>Paused</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Completed")}>Completed</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    task.urgency === "Urgent" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" :
                                                        task.urgency === "High" ? "bg-amber-500" :
                                                            "bg-muted-foreground/20"
                                                )} />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-popover border-border">
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Low")}>Low</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Normal")}>Normal</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "High")}>High</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Urgent")}>Urgent</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {activeTimer && activeTimer.taskId === task.id ? (
                                            <div className="flex items-center gap-1">
                                                {activeTimer.status === 'paused' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleResumeTimer()
                                                        }}
                                                        title="Resume Timer"
                                                    >
                                                        <Play className="h-3.5 w-3.5 fill-current" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handlePauseTimer()
                                                        }}
                                                        title="Pause Timer"
                                                    >
                                                        <Pause className="h-3.5 w-3.5 fill-current" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "h-6 gap-1.5 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full",
                                                        activeTimer.status === 'running' && "animate-pulse"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleStopTimer()
                                                    }}
                                                    title="Stop Timer"
                                                >
                                                    <Square className="h-2.5 w-2.5 fill-current" />
                                                    <span className="text-[10px] font-mono font-bold">
                                                        {activeTimer.status === 'paused' ? "Paused" : formatTimer(timerDuration)}
                                                    </span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-full"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleStartTimer(task)
                                                }}
                                                title="Start Timer"
                                            >
                                                <Play className="h-3.5 w-3.5 fill-current" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setQuickLogTask(task)
                                            }}
                                            title="Log Time Manually"
                                        >
                                            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                                        </Button>

                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 text-[11px] font-medium text-muted-foreground/60 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Users className="h-3.5 w-3.5 opacity-40 shrink-0" strokeWidth={1.5} />
                                            <span className="truncate">{task.project.site.partner.name}</span>
                                        </div>
                                        {task.deadline && (
                                            <div className={cn(
                                                "flex items-center gap-2 shrink-0 px-2 py-0.5 rounded-md bg-muted/50 border border-border",
                                                new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500 border-rose-500/20" : ""
                                            )}>
                                                <CalendarIcon className="h-3.5 w-3.5 opacity-40" strokeWidth={1.5} />
                                                <span>{format(new Date(task.deadline), "MMM dd")}</span>
                                            </div>
                                        )}
                                        {(task.timeLogs && task.timeLogs.length > 0 || (activeTimer && activeTimer.taskId === task.id)) && (
                                            <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/5 text-emerald-600 border border-emerald-500/10">
                                                <Clock className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} />
                                                <span>
                                                    {(() => {
                                                        const logsDuration = task.timeLogs.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0)
                                                        const currentTimerDuration = activeTimer && activeTimer.taskId === task.id ? timerDuration : 0
                                                        const totalSeconds = logsDuration + currentTimerDuration

                                                        const hours = Math.floor(totalSeconds / 3600)
                                                        const mins = Math.floor((totalSeconds % 3600) / 60)
                                                        return `${hours}h ${mins}m`
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 pt-4 border-t border-border">
                                        {/* Project Sideview Link */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedProject(task.project)
                                            }}
                                            className="group/project flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Briefcase className="h-3.5 w-3.5 text-primary opacity-60 group-hover/project:opacity-100" strokeWidth={1.5} />
                                                <span className="text-[11px] font-semibold text-foreground/80 group-hover/project:text-foreground transition-colors truncate">
                                                    {task.project.name || task.project.site.domainName}
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold opacity-0 group-hover/project:opacity-40 transition-opacity">PROJ</div>
                                        </div>

                                        {/* Site Sideview Link */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedSite(task.project.site)
                                            }}
                                            className="group/site flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Globe className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/site:text-primary transition-colors" strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium text-muted-foreground group-hover/site:text-foreground transition-colors truncate">
                                                    {task.project.site.domainName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {tasks.length === 0 && (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/30">
                        <Clock className="h-8 w-8 text-muted-foreground/20 mb-4" strokeWidth={1} />
                        <p className="text-sm text-muted-foreground/60 font-medium">
                            No active tasks found in this view.
                        </p>
                    </div>
                )}
            </div>

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />

            {/* Project Details Sheet */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" className="sm:max-w-[800px] w-full p-0 flex flex-col border-none shadow-xl bg-background backdrop-blur-3xl overflow-hidden">
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            onUpdate={(updated) => setSelectedProject((prev: any) => ({ ...prev, ...updated }))}
                            onOpenSite={(site) => setSelectedSite(site)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background backdrop-blur-3xl shadow-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => setSelectedSite({ ...selectedSite, ...updated })}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Quick Time Log Dialog */}
            {quickLogTask && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => !open && setQuickLogTask(null)}
                    projectId={quickLogTask.projectId}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name}
                    projectName={quickLogTask.project.name || quickLogTask.project.site.domainName}
                />
            )}

        </div >
    )
}
