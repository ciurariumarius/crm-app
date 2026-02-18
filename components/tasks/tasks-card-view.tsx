"use client"

import * as React from "react"
import { format } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { deleteTasks, updateTasksStatus, getProjectDetails, updateTask } from "@/lib/actions"
import { toast } from "sonner"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { Clock, Trash2, MoreVertical, Play, Pause, Calendar as CalendarIcon, Plus, CheckCircle2 } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"

import { useTimer } from "@/components/providers/timer-provider"

interface TasksCardViewProps {
    tasks: any[]
    allServices: any[]
    initialActiveTimer?: any
    projects?: any[]
}

export function TasksCardView({ tasks, allServices, initialActiveTimer, projects = [] }: TasksCardViewProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const [selectedSite, setSelectedSite] = React.useState<any>(null)
    const [selectedTask, setSelectedTask] = React.useState<any>(null)
    const [quickLogTask, setQuickLogTask] = React.useState<any>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [isBulkOperating, setIsBulkOperating] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    const handleStartTimer = async (task: any) => {
        await globalStartTimer(task.projectId, task.id, task.name)
    }

    const handleStopTimer = async () => {
        await globalStopTimer()
    }

    const handlePauseTimer = async () => {
        await globalPauseTimer()
    }

    const handleResumeTimer = async () => {
        await globalResumeTimer()
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

    // ... return statement start
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
                            {/* ... bulk buttons ... */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {tasks.map((task) => {
                    // Time Calculation
                    const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
                    const currentTimerDuration = timerState.taskId === task.id ? timerState.elapsedSeconds : 0
                    const totalSeconds = logsDuration + currentTimerDuration
                    const hours = Math.floor(totalSeconds / 3600)
                    const mins = Math.floor((totalSeconds % 3600) / 60)
                    const timeString = totalSeconds > 0 ? `${hours > 0 ? `${hours}h ` : ''}${mins}m` : "0m"



                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group relative flex flex-col justify-between bg-card text-card-foreground rounded-[32px] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-transparent hover:border-border/50",
                                selectedIds.includes(task.id) && "ring-2 ring-primary"
                            )}
                            onClick={() => setSelectedTask(task)}
                        >
                            {/* Selection Checkbox (Hidden unless hovered/selected) */}
                            <div
                                className={cn(
                                    "absolute top-8 right-8 z-10 transition-opacity duration-200",
                                    selectedIds.includes(task.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSelect(task.id)
                                }}
                            >
                                <Checkbox
                                    checked={selectedIds.includes(task.id)}
                                    className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </div>

                            <div>
                                {/* Header: Urgency & Estimate */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex items-center gap-2">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="flex items-center gap-2 hover:bg-muted/50 rounded-full px-2 py-1 transition-colors -ml-2">
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            task.status === "Active" ? "bg-emerald-500" :
                                                                task.status === "Paused" ? "bg-amber-500" :
                                                                    "bg-blue-500"
                                                        )} />
                                                        <span className={cn(
                                                            "text-[11px] font-bold uppercase tracking-widest",
                                                            task.status === "Active" ? "text-emerald-500" :
                                                                task.status === "Paused" ? "text-amber-500" :
                                                                    "text-blue-500"
                                                        )}>
                                                            {task.status || "ACTIVE"}
                                                        </span>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { status: "Active" })}>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                                        Active
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { status: "Paused" })}>
                                                        <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                                                        Paused
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { status: "Completed" })}>
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                                        Completed
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="flex items-center gap-2 hover:bg-muted/50 rounded-full px-2 py-1 transition-colors">
                                                        <div className={cn(
                                                            "w-1.5 h-1.5 rounded-full ring-1 ring-offset-1",
                                                            task.urgency === "Urgent" ? "bg-rose-500 ring-rose-500" :
                                                                task.urgency === "Idea" ? "bg-indigo-500 ring-indigo-500" :
                                                                    "bg-muted-foreground/30 ring-muted-foreground/30"
                                                        )} />
                                                        <span className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest opacity-70",
                                                            task.urgency === "Urgent" ? "text-rose-500 opacity-100" :
                                                                task.urgency === "Idea" ? "text-indigo-500 opacity-100" :
                                                                    "text-muted-foreground"
                                                        )}>
                                                            {task.urgency || "NORMAL"}
                                                        </span>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { urgency: "Normal" })}>
                                                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mr-2" />
                                                        Normal
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { urgency: "Urgent" })}>
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                                                        Urgent
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => updateTask(task.id, { urgency: "Idea" })}>
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2" />
                                                        Idea
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {task.estimatedMinutes && (
                                        <span className="text-[11px] font-medium text-muted-foreground/40">
                                            Est: {task.estimatedMinutes}m
                                        </span>
                                    )}

                                    {task.deadline && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-[11px] font-medium",
                                            new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500" : "text-muted-foreground/40"
                                        )}>
                                            <CalendarIcon className="h-3 w-3" strokeWidth={1.5} />
                                            <span>{format(new Date(task.deadline), "MMM dd")}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className={cn(
                                    "text-lg font-bold leading-snug tracking-tight mb-6 text-foreground/90 pr-4",
                                    task.status === "Completed" && "line-through opacity-50"
                                )}>
                                    {task.name}
                                </h3>

                                {/* Project Info */}
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 break-words leading-tight">
                                        {task.project.name || task.project.site.domainName}
                                    </span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-end justify-between mt-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 rounded-full bg-muted/50 flex items-center justify-center px-3 text-[10px] font-black text-muted-foreground/70 uppercase">
                                        {format(new Date(task.createdAt), "MMM dd, yyyy")}
                                    </div>
                                    {/* Play Button (Hover only) */}
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 gap-2">
                                        <button
                                            className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (timerState.taskId === task.id && timerState.isRunning) {
                                                    handlePauseTimer()
                                                } else if (timerState.taskId === task.id) {
                                                    handleResumeTimer()
                                                } else {
                                                    handleStartTimer(task)
                                                }
                                            }}
                                            title={timerState.taskId === task.id && timerState.isRunning ? "Pause Timer" : "Start Timer"}
                                        >
                                            {timerState.taskId === task.id && timerState.isRunning ? (
                                                <Pause className="h-3.5 w-3.5 fill-current" />
                                            ) : (
                                                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                                            )}
                                        </button>
                                        <button
                                            className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-all hover:scale-110 hover:bg-foreground hover:text-background shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setQuickLogTask(task)
                                            }}
                                            title="Log Time Manually"
                                        >
                                            <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                                        </button>
                                        <button
                                            className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center transition-all hover:scale-110 hover:bg-emerald-500 hover:text-white shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                updateTask(task.id, { status: "Completed" })
                                                toast.success("Task marked as completed")
                                            }}
                                            title="Mark as Completed"
                                        >
                                            <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end">
                                    <span className="text-xl font-bold tracking-tighter text-foreground/80">
                                        {timeString}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">
                                        Spent
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {
                    tasks.length === 0 && (
                        <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/30">
                            <Clock className="h-8 w-8 text-muted-foreground/20 mb-4" strokeWidth={1} />
                            <p className="text-sm text-muted-foreground/60 font-medium">
                                No active tasks found in this view.
                            </p>
                        </div>
                    )
                }
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
            {
                quickLogTask && (
                    <QuickTimeLogDialog
                        open={!!quickLogTask}
                        onOpenChange={(open) => !open && setQuickLogTask(null)}
                        projectId={quickLogTask.projectId}
                        taskId={quickLogTask.id}
                        taskName={quickLogTask.name}
                        projectName={quickLogTask.project.name || quickLogTask.project.site.domainName}
                    />
                )
            }

            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={projects}
            />

        </div >
    )
}
