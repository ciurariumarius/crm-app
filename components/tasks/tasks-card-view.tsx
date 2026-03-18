"use client"

import * as React from "react"
import { format, isToday, isPast } from "date-fns"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import { deleteTasks, updateTasksStatus, updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { Clock, Trash2, MoreVertical, Play, Pause, Square, Target, ArrowRight, Plus, Lightbulb, CalendarClock, AlertTriangle } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import { TaskGridCard } from "./task-grid-card"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"

import { useTimer } from "@/components/providers/timer-provider"
import { useTasksSearchContext } from "./tasks-search-context"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"
import type { TaskDialogProject } from "./global-create-task-dialog"

type TimeLogSummary = {
    id?: string
    durationSeconds?: number | null
    startTime?: string | Date | null
    endTime?: string | Date | null
    notes?: string | null
}

type TaskProjectSummary = {
    id?: string
    name?: string | null
    createdAt?: string | Date | null
    site?: {
        id?: string
        domainName?: string | null
        partner?: { id: string; name: string } | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
    tasks?: Array<{
        timeLogs?: TimeLogSummary[] | null
    }> | null
    timeLogs?: TimeLogSummary[] | null
}

type TaskCardViewTask = {
    id: string
    projectId?: string | null
    name?: string | null
    description?: string | null
    status?: string | null
    urgency?: string | null
    deadline?: string | Date | null
    estimatedMinutes?: number | null
    timeLogs?: TimeLogSummary[] | null
    project?: TaskProjectSummary | null
}

type SiteWithOptionalPartner = {
    id?: string
    domainName?: string | null
    partner?: { id: string; name: string } | null
    [key: string]: unknown
}

interface TasksCardViewProps {
    tasks: TaskCardViewTask[]
    allServices: Service[]
    initialActiveTimer?: unknown
    projects?: TaskDialogProject[]
    view?: "grid" | "list"
    cols?: number
    hourlyRate?: number
}

export function TasksCardView({ tasks, allServices, initialActiveTimer: _initialActiveTimer, projects = [], view = "grid", cols = 3, hourlyRate = 0 }: TasksCardViewProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const searchContext = useTasksSearchContext()
    void _initialActiveTimer
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<SiteWithOptionalPartner | null>(null)
    const [selectedTask, setSelectedTask] = React.useState<TaskCardViewTask | null>(null)
    const [quickLogTask, setQuickLogTask] = React.useState<TaskCardViewTask | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [isBulkOperating, setIsBulkOperating] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    const handleStartTimer = async (task: TaskCardViewTask) => {
        if (!task.projectId) {
            toast.error("Task has no project")
            return
        }
        await globalStartTimer(task.projectId, task.id, task.name || "Task")
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
        } catch {
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
        } catch {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleComplete = async (taskId: string) => {
        try {
            const result = await updateTask(taskId, { status: 'Completed' })
            if (result.success) {
                toast.success("Task completed")
            } else {
                toast.error(result.error || "Failed to complete task")
            }
        } catch {
            toast.error("Process failed")
        }
    }

    const renderTaskActionMenu = (task: TaskCardViewTask) => (
        <>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuickLogTask(task); }} className="gap-2 text-sm font-medium cursor-pointer">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Add Manual Time
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer" onClick={(e) => {
                e.stopPropagation()
                if (confirm("Delete this task?")) {
                    deleteTasks([task.id]).then(() => toast.success("Task deleted"))
                }
            }}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Task
            </DropdownMenuItem>
        </>
    )

    const getStatusStyle = (status: string) => {
        if (status === "Active" || status === "Paused") return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
        if (status === "Completed") return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
        return "bg-muted text-muted-foreground border border-border"
    }

    const getUrgencyIcon = (urgency: string) => {
        const normalizedUrgency = normalizeTaskUrgency(urgency)
        if (normalizedUrgency === "Urgent") return <AlertTriangle className="h-4 w-4 fill-[#F84444] text-white" />
        if (normalizedUrgency === "Idea") return <Lightbulb className="h-3 w-3" />
        return <ArrowRight className="h-3 w-3" strokeWidth={3} />
    }

    const colsClass = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    }[cols] ?? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

    const normalizedSearch = (searchContext?.searchTerm || "").trim().toLowerCase()
    const visibleTasks = React.useMemo(() => {
        if (!normalizedSearch) return tasks
        return tasks.filter((task) => {
            const fields = [
                task.name,
                task.description,
                task.status,
                task.urgency,
                task.project?.name,
                task.project?.site?.domainName,
                task.project?.site?.partner?.name,
                formatProjectName(task.project || {}),
                (task.project?.services || []).map((service) => service.serviceName || "").join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return fields.includes(normalizedSearch)
        })
    }, [normalizedSearch, tasks])

    const renderGridView = () => (
        <div className={cn("grid gap-6", colsClass)}>
            {visibleTasks.map((task) => (
                <TaskGridCard
                    key={task.id}
                    task={task}
                    onOpen={(taskId) => {
                        const found = visibleTasks.find(t => t.id === taskId)
                        if (found) setSelectedTask(found)
                    }}
                    onComplete={handleComplete}
                    renderMenu={renderTaskActionMenu}
                    isSelected={selectedIds.includes(task.id)}
                    onSelect={toggleSelect}
                />
            ))}

            <div
                className="border border-dashed border-slate-200 bg-slate-50/30 rounded-3xl flex flex-col items-center justify-center text-center py-6 px-4 self-start cursor-pointer transition-all duration-300 group hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm"
                onClick={() => setCreateTaskOpen(true)}
            >
                <div className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all duration-300">
                    <Plus className="h-5 w-5 text-slate-400 group-hover:text-white" strokeWidth={2} />
                </div>
                <p className="font-semibold text-[13px] text-slate-500 mt-3 group-hover:text-emerald-700 transition-colors">
                    Quick add task...
                </p>
            </div>
        </div>
    )

    const renderListView = () => (
        <div className="flex flex-col gap-3">
            <div className="hidden lg:grid grid-cols-[auto_1fr_auto_auto_auto] gap-6 text-xs font-semibold text-muted-foreground px-8 py-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-6 w-16">
                    <span className="w-8 text-center">PRI</span>
                </div>
                <div>TASK / PROJECT / DESCRIPTION</div>
                <div className="w-24 text-center">STATUS</div>
                <div className="w-32 text-center">DEADLINE</div>
                <div className="w-48 text-right">TIME TRACKING</div>
            </div>

            <div className="flex flex-col gap-3">
                {visibleTasks.map((task) => {
                    const logsDuration = task.timeLogs?.reduce((acc: number, log: TimeLogSummary) => acc + (log.durationSeconds || 0), 0) || 0
                    const isActiveTimerThisTask = timerState.taskId === task.id
                    const isRunning = isActiveTimerThisTask && timerState.isRunning
                    const isPaused = isActiveTimerThisTask && !timerState.isRunning
                    const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
                    const totalSeconds = logsDuration + currentTimerDuration
                    const timeString = formatTimer(totalSeconds)
                    const isOverdue = task.deadline && isPast(new Date(task.deadline))
                    const isDueToday = task.deadline && isToday(new Date(task.deadline))
                    const activeHighlight = isRunning ? "text-blue-600" : "text-foreground"

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 bg-card rounded-xl p-6 lg:px-8 shadow-sm hover:shadow-md border border-border/60 hover:border-border/80 transition-all duration-300 cursor-pointer relative overflow-hidden",
                                selectedIds.includes(task.id) && "border-primary ring-2 ring-primary/20 bg-primary/5"
                            )}
                            onClick={() => setSelectedTask(task)}
                        >
                            {/* Mobile only elements implicitly stacked, Desktop uses precise widths */}
                            <div className="flex items-center gap-6 lg:w-16 shrink-0">
                                <div className="w-8 flex justify-center" title={task.urgency || undefined}>
                                    {getUrgencyIcon(task.urgency || "Normal")}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className={cn("text-base font-bold text-foreground/90 break-words whitespace-normal", task.status === "Completed" && "line-through opacity-50")}>
                                    {task.name}
                                </h3>
                                {task.project ? (
                                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 break-words whitespace-normal leading-tight">
                                        {formatProjectName(task.project)}
                                    </p>
                                ) : null}
                                {task.description && (
                                    <p className="text-sm text-muted-foreground/70 truncate mt-1.5 hidden lg:block">
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between lg:justify-end gap-6 lg:w-auto shrink-0 mt-4 lg:mt-0">
                                <div className="w-auto lg:w-24 flex lg:justify-center shrink-0">
                                    <div className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", getStatusStyle(task.status || "Active"))}>
                                        {task.status || "Active"}
                                    </div>
                                </div>

                                <div className="w-auto lg:w-32 flex lg:justify-center shrink-0">
                                    {task.deadline ? (
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-xs font-semibold tracking-tight uppercase",
                                            isOverdue ? "text-[#F84444]" : "text-blue-600"
                                        )}>
                                            {isOverdue ? <Clock className="w-3.5 h-3.5" /> : isDueToday ? <CalendarClock className="w-4 h-4" /> : <Target className="w-3.5 h-3.5" />}
                                            {isDueToday ? "TODAY" : format(new Date(task.deadline), "dd MMM")}
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
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">Spent / Est</div>
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
                        <span className="text-xs font-semibold text-primary">
                            {selectedIds.length} Selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-semibold bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Completed")}
                                disabled={isBulkOperating}
                            >
                                Complete
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-semibold bg-muted hover:bg-muted/80 border border-border"
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
                            className="h-8 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
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

            {visibleTasks.length === 0 ? (
                <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/30">
                    <Clock className="h-8 w-8 text-muted-foreground/20 mb-4" strokeWidth={1} />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                        {normalizedSearch ? "No tasks match your search." : "No active tasks found in this view."}
                    </p>
                </div>
            ) : (
                view === "list" ? renderListView() : renderGridView()
            )}

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
                onOpenProject={(project) => {
                    setSelectedProject(project as unknown as ProjectWithDetails)
                }}
                onOpenSite={(site) => {
                    setSelectedSite(site)
                }}
            />

            {/* Project Details Sheet */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" className="z-[80] w-screen max-w-none p-0 flex flex-col border-none shadow-xl bg-background overflow-hidden sm:w-full sm:max-w-[760px]">
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onUpdate={(updated) => setSelectedProject((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onOpenSite={(site) => setSelectedSite(site)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="w-screen max-w-none p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background shadow-xl sm:w-full sm:max-w-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite as Site & { partner?: { id: string; name: string } }}
                            onUpdate={(updated) => setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Quick Time Log Dialog */}
            {quickLogTask && quickLogTask.projectId && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => !open && setQuickLogTask(null)}
                    projectId={quickLogTask.projectId}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name || "Task"}
                    projectName={quickLogTask.project ? formatProjectName(quickLogTask.project) : "Unknown Project"}
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
