"use client"

import * as React from "react"
import { format, isToday, isPast } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { deleteTasks, updateTasksStatus, updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { Clock, Trash2, MoreVertical, Play, Pause, Square, Calendar as CalendarIcon, Target, Zap, CheckSquare, CheckCircle2, ArrowRight } from "lucide-react"
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
    view?: "grid" | "list"
}

export function TasksCardView({ tasks, allServices, initialActiveTimer, projects = [], view = "grid" }: TasksCardViewProps) {
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
        return `${h > 0 ? `${h}h ` : ''}${m}m`
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

    const renderTaskActionMenu = (task: any) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors" onClick={e => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] p-2 rounded-2xl shadow-xl border-border/40">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleSelect(task.id); }} className="px-3 py-2 text-xs font-semibold rounded-xl focus:bg-primary/5 cursor-pointer">
                    <CheckSquare className="mr-3 h-4 w-4 text-muted-foreground" /> Select Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuickLogTask(task); }} className="px-3 py-2 text-xs font-semibold rounded-xl focus:bg-primary/5 cursor-pointer">
                    <Clock className="mr-3 h-4 w-4 text-muted-foreground" /> Add Manual Time
                </DropdownMenuItem>
                <div className="h-px bg-border/40 my-1 mx-2" />
                <DropdownMenuItem className="px-3 py-2 text-xs font-semibold rounded-xl text-rose-500 focus:bg-rose-500/10 focus:text-rose-600 cursor-pointer" onClick={(e) => {
                    e.stopPropagation()
                    if (confirm("Delete this task?")) {
                        deleteTasks([task.id]).then(() => toast.success("Task deleted"))
                    }
                }}>
                    <Trash2 className="mr-3 h-4 w-4" /> Delete Task
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const getStatusStyle = (status: string) => {
        if (status === "Active") return "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
        if (status === "Paused") return "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
        if (status === "Completed") return "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
        return "bg-muted text-muted-foreground"
    }

    const getUrgencyIcon = (urgency: string) => {
        if (urgency === "Urgent") return <Zap className="h-3 w-3 fill-current" />
        if (urgency === "Medium") return <ArrowRight className="h-3 w-3" strokeWidth={3} />
        if (urgency === "Idea") return <Target className="h-3 w-3" />
        return <ArrowRight className="h-3 w-3 text-muted-foreground/80" strokeWidth={2} />
    }

    const renderGridView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {tasks.map((task) => {
                const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
                const isActiveTimerThisTask = timerState.taskId === task.id
                const isRunning = isActiveTimerThisTask && timerState.isRunning
                const isPaused = isActiveTimerThisTask && !timerState.isRunning
                const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
                const totalSeconds = logsDuration + currentTimerDuration
                const timeString = formatTimer(totalSeconds)
                const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline))
                const isDueToday = task.deadline && isToday(new Date(task.deadline))
                const activeHighlight = isRunning ? "text-blue-600" : "text-foreground"

                return (
                    <div
                        key={task.id}
                        className={cn(
                            "group relative flex flex-col bg-card text-card-foreground rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border hover:border-border/80",
                            selectedIds.includes(task.id) ? "border-primary ring-2 ring-primary/20" : "border-border/30"
                        )}
                        onClick={() => setSelectedTask(task)}
                    >
                        {selectedIds.includes(task.id) && (
                            <div className="absolute top-6 right-16 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(task.id) }}>
                                <Checkbox checked className="h-5 w-5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                            </div>
                        )}

                        {/* Top Header Row */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2 flex-wrap">
                                {task.urgency && (
                                    <div className={cn(
                                        "px-3 py-1.5 flex items-center gap-1.5 rounded-full border text-[9px] font-black tracking-widest uppercase",
                                        task.urgency === "Urgent" ? "border-rose-500 text-rose-500" :
                                            task.urgency === "Medium" ? "border-blue-500 text-blue-500" :
                                                task.urgency === "Idea" ? "border-indigo-500 text-indigo-500" :
                                                    "border-border/60 text-muted-foreground/80 bg-background shadow-xs hover:border-border transition-colors"
                                    )}>
                                        {getUrgencyIcon(task.urgency)} {task.urgency}
                                    </div>
                                )}
                                {task.deadline && (
                                    <div className={cn(
                                        "px-3 py-1.5 flex items-center gap-1.5 rounded-full text-[9px] font-black tracking-[0.15em] uppercase border",
                                        isOverdue || isDueToday ? "bg-[#dc2626] text-white border-[#dc2626] shadow-sm shadow-red-500/20" : "bg-muted border-transparent text-muted-foreground/80"
                                    )}>
                                        <Target className="h-3 w-3" /> DUE: {isDueToday ? "TODAY, 18:00" : format(new Date(task.deadline), "MMM dd, yyyy")}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {renderTaskActionMenu(task)}
                            </div>
                        </div>

                        {/* Title and Project */}
                        <h3 className={cn("text-2xl md:text-[26px] font-black leading-tight tracking-tight mb-2 text-foreground", task.status === "Completed" && "line-through opacity-50")}>
                            {task.name}
                        </h3>
                        {task.project && (
                            <div className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-blue-600 mb-4 line-clamp-1">
                                {task.project.name || task.project.site?.domainName}
                            </div>
                        )}
                        {task.description && (
                            <p className="text-sm md:text-base text-muted-foreground/80 line-clamp-2 leading-relaxed">
                                {task.description}
                            </p>
                        )}

                        <div className="flex-1 min-h-[40px]" />

                        {/* Footer Controls */}
                        <div className="flex items-end justify-between mt-6">
                            <div className="flex items-center gap-6">
                                <div className="bg-muted/40 dark:bg-zinc-900/50 rounded-full p-1.5 flex items-center gap-1 border border-border/50" onClick={e => e.stopPropagation()}>
                                    <button
                                        className={cn(
                                            "h-10 w-12 rounded-full flex items-center justify-center transition-all",
                                            isRunning ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm hover:scale-[1.02]"
                                        )}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (isRunning) {
                                                handlePauseTimer()
                                            } else if (isPaused) {
                                                handleResumeTimer()
                                            } else {
                                                handleStartTimer(task)
                                            }
                                        }}
                                    >
                                        {isRunning ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                                    </button>

                                    {isActiveTimerThisTask && (
                                        <button
                                            className="h-10 w-10 rounded-full flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all border border-transparent"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleStopTimer()
                                            }}
                                        >
                                            <Square className="h-4 w-4 fill-current" />
                                        </button>
                                    )}

                                    <button
                                        className="h-10 w-10 rounded-full flex items-center justify-center bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500 transition-all"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            updateTask(task.id, { status: "Completed" })
                                            toast.success("Task completed")
                                        }}
                                    >
                                        <CheckCircle2 className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="flex flex-col items-start pt-1">
                                    <div className="text-xl md:text-2xl font-black tracking-tight flex items-baseline gap-1">
                                        <span className={activeHighlight}>{timeString}</span>
                                        {task.estimatedMinutes && (
                                            <span className="text-muted-foreground/30 text-xs md:text-sm font-bold">/ {Math.floor(task.estimatedMinutes / 60)}h{task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}</span>
                                        )}
                                    </div>
                                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 mt-0.5">Spent / Est</div>
                                </div>
                            </div>

                            <div className={cn("px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.15em]", getStatusStyle(task.status))}>
                                {task.status}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )

    const renderListView = () => (
        <div className="bg-card rounded-[32px] p-2 shadow-sm border border-border/50 overflow-hidden">
            <div className="hidden lg:grid grid-cols-[auto_1fr_auto_auto_auto] gap-6 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] px-8 py-5 border-b border-border/30">
                <div className="flex items-center gap-6 w-36">
                    <span className="w-8 text-center">PRI</span>
                    <span>CREATED</span>
                </div>
                <div>TASK / PROJECT / DESCRIPTION</div>
                <div className="w-24 text-center">STATUS</div>
                <div className="w-32 text-center">DEADLINE</div>
                <div className="w-48 text-right">TIME TRACKING</div>
            </div>

            <div className="divide-y divide-border/30">
                {tasks.map((task) => {
                    const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
                    const isActiveTimerThisTask = timerState.taskId === task.id
                    const isRunning = isActiveTimerThisTask && timerState.isRunning
                    const isPaused = isActiveTimerThisTask && !timerState.isRunning
                    const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
                    const totalSeconds = logsDuration + currentTimerDuration
                    const timeString = formatTimer(totalSeconds)
                    const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline))
                    const isDueToday = task.deadline && isToday(new Date(task.deadline))
                    const activeHighlight = isRunning ? "text-blue-600" : "text-foreground"

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 bg-transparent hover:bg-muted/20 p-6 lg:px-8 border-transparent transition-colors cursor-pointer relative",
                                selectedIds.includes(task.id) && "bg-primary/5 hover:bg-primary/10"
                            )}
                            onClick={() => setSelectedTask(task)}
                        >
                            {/* Mobile only elements implicitly stacked, Desktop uses precise widths */}
                            <div className="flex items-center gap-6 lg:w-36 shrink-0">
                                <div className="w-8 flex justify-center" title={task.urgency}>
                                    {getUrgencyIcon(task.urgency)}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground/60 flex items-center gap-1.5 whitespace-nowrap">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span className="hidden lg:inline">{format(new Date(task.createdAt), "MMM dd")}</span>
                                    <span className="inline lg:hidden">{format(new Date(task.createdAt), "MMM dd, yyyy")}</span>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className={cn("text-base font-bold truncate text-foreground/90", task.status === "Completed" && "line-through opacity-50")}>
                                    {task.name}
                                </h3>
                                {task.project && (
                                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 truncate mt-1">
                                        {task.project.name || task.project.site?.domainName}
                                    </div>
                                )}
                                {task.description && (
                                    <p className="text-sm text-muted-foreground/70 truncate mt-1.5 hidden lg:block">
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between lg:justify-end gap-6 lg:w-auto shrink-0 mt-4 lg:mt-0">
                                <div className="w-auto lg:w-24 flex lg:justify-center shrink-0">
                                    <div className={cn("px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest", getStatusStyle(task.status))}>
                                        {task.status}
                                    </div>
                                </div>

                                <div className="w-auto lg:w-32 flex lg:justify-center shrink-0">
                                    {task.deadline ? (
                                        <div className={cn("flex items-center gap-1.5 text-xs font-bold tracking-tight", isOverdue || isDueToday ? "text-rose-500" : "text-muted-foreground")}>
                                            <Target className="w-3.5 h-3.5" />
                                            {isDueToday ? "Today, 18:00" : format(new Date(task.deadline), "MMM dd")}
                                        </div>
                                    ) : (
                                        <div className="text-xs font-medium text-muted-foreground/30">-</div>
                                    )}
                                </div>

                                <div className="w-auto lg:w-48 flex items-center justify-end gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-col items-end">
                                        <div className="text-sm font-bold tracking-tighter flex items-baseline gap-1">
                                            <span className={activeHighlight}>{timeString}</span>
                                            {task.estimatedMinutes && (
                                                <span className="text-muted-foreground/40 text-[11px] font-medium">/ {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}</span>
                                            )}
                                        </div>
                                        <div className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/30">Spent / Est</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-muted/30 rounded-xl p-1 border border-border/40">
                                        <button
                                            className={cn(
                                                "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                                isRunning ? "bg-amber-500/20 text-amber-600" : "bg-transparent text-muted-foreground hover:bg-background hover:shadow-sm"
                                            )}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                if (isRunning) {
                                                    handlePauseTimer()
                                                } else if (isPaused) {
                                                    handleResumeTimer()
                                                } else {
                                                    handleStartTimer(task)
                                                }
                                            }}
                                        >
                                            {isRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                                        </button>

                                        {isActiveTimerThisTask && (
                                            <button
                                                className="h-7 w-7 rounded-lg flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleStopTimer()
                                                }}
                                            >
                                                <Square className="h-3 w-3 fill-current" />
                                            </button>
                                        )}

                                        {renderTaskActionMenu(task)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )

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

            {tasks.length === 0 ? (
                <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/30">
                    <Clock className="h-8 w-8 text-muted-foreground/20 mb-4" strokeWidth={1} />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                        No active tasks found in this view.
                    </p>
                </div>
            ) : (
                view === "list" ? renderListView() : renderGridView()
            )}

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

            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={projects}
            />

        </div>
    )
}
