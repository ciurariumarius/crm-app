"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, CheckCircle2, Target, Plus, LayoutGrid, Sparkles, Trash2 } from "lucide-react"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import Link from "next/link"
import { deleteTasks } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { normalizeTaskUrgency } from "@/lib/status"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"

type UpcomingTask = {
    id: string
    name?: string | null
    status?: string | null
    taskScope?: string | null
    estimatedMinutes?: number | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null; defaultDurationMinutes?: number | null } | null
    urgency?: string | null
    projectId?: string | null
    deadline?: string | Date | null
    project?: {
        id?: string
        name?: string | null
        createdAt?: string | Date | null
        site?: {
            domainName?: string | null
        } | null
        services?: Array<{
            serviceName: string
            isRecurring?: boolean | null
        }>
    } | null
}

type QuickLogTask = {
    id: string
    name?: string | null
    projectId?: string | null
}

interface UpcomingTasksProps {
    tasks: UpcomingTask[]
    projects?: TaskDialogProject[]
}

export function UpcomingTasks({ tasks, projects = [] }: UpcomingTasksProps) {
    const { openTask } = React.useContext(TaskSheetContext)
    const { requestCompletion } = useTaskCompletion()
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [quickLogTask, setQuickLogTask] = React.useState<QuickLogTask | null>(null)
    const [cols, setCols] = React.useState<3 | 4>(3)
    const [filter, setFilter] = React.useState<"all" | "high" | "medium" | "low">("all")
    const [optimisticTasks, setOptimisticTasks] = React.useOptimistic(
        tasks,
        (state, updatedTask: string) => state.filter((task) => task.id !== updatedTask)
    )

    // Persist column preference
    React.useEffect(() => {
        const saved = localStorage.getItem("dashboard.tasks.cols")
        if (saved === "4") setCols(4)
    }, [])

    const handleSetCols = (c: 3 | 4) => {
        setCols(c)
        localStorage.setItem("dashboard.tasks.cols", String(c))
    }

    const filteredTasks = React.useMemo(() => {
        switch (filter) {
            case "high":
                return optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "High")
            case "medium":
                return optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "Medium")
            case "low":
                return optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "Low")
            default:
                return optimisticTasks
        }
    }, [optimisticTasks, filter])

    const handleComplete = (taskId: string) => {
        const task = optimisticTasks.find((entry) => entry.id === taskId)
        if (!task) return
        requestCompletion(task, {
            onCompleted: () => React.startTransition(() => setOptimisticTasks(taskId)),
        })
    }

    const highTasks = optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "High")
    const mediumTasks = optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "Medium")
    const lowTasks = optimisticTasks.filter(t => normalizeTaskUrgency(t.urgency) === "Low")

    return (
        <>
            <div className="flex flex-col h-full bg-transparent overflow-hidden">
                {/* Header Section */}
                <div className="py-4 px-1 flex flex-col gap-5">
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-[var(--state-success-surface)] flex items-center justify-center text-[var(--state-success)]">
                                <Target className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold tracking-[0.02em] text-foreground">
                                    Your Tasks
                                </h2>
                                <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-muted-foreground">
                                    <span className={cn(highTasks.length > 0 && "font-bold text-rose-600 dark:text-rose-400")}>
                                        {highTasks.length} high
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {mediumTasks.length} medium
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {lowTasks.length} low
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Column switcher */}
                            <div className="flex items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1 shadow-sm gap-0.5">
                                {([3, 4] as const).map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => handleSetCols(c)}
                                        title={`${c} columns`}
                                        className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                                            cols === c
                                                ? "bg-[var(--surface-low)] text-[var(--text-primary)]"
                                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                            <Link href="/tasks" className="hidden md:block">
                                <Button variant="ghost" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                                    View All
                                </Button>
                            </Link>
                            <Button
                                size="icon"
                                className="h-10 w-10 bg-[var(--state-success)] text-[var(--state-success)] shadow-lg shadow-emerald-500/20 rounded-full hover:bg-[var(--state-success)] hover:scale-105 transition-all"
                                onClick={() => setCreateTaskOpen(true)}
                            >
                                <Plus className="h-5 w-5" strokeWidth={3} />
                            </Button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-4 border-b border-border/40">
                        <button
                            onClick={() => setFilter("all")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-semibold tracking-[0.02em] transition-all relative",
                                filter === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            All Tasks
                            {filter === "all" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground rounded-full" />}
                        </button>
                        <button
                            onClick={() => setFilter("high")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-semibold tracking-[0.02em] transition-all relative",
                                filter === "high" ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground hover:text-rose-600"
                            )}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            High Priority
                            {filter === "high" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full bg-rose-500" />}
                        </button>
                        <button
                            onClick={() => setFilter("medium")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-semibold tracking-[0.02em] transition-all relative",
                                filter === "medium" ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Medium Priority
                            {filter === "medium" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full bg-foreground" />}
                        </button>
                        <button
                            onClick={() => setFilter("low")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-semibold tracking-[0.02em] transition-all relative",
                                filter === "low" ? "text-zinc-500 font-bold" : "text-muted-foreground hover:text-zinc-500"
                            )}
                        >
                            Low Priority
                            {filter === "low" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full bg-zinc-400" />}
                        </button>
                    </div>

                    {/* Progress Bar (Decoration) */}
                    <div className="h-1 w-full bg-[var(--state-success-surface)] rounded-full overflow-hidden -mt-2">
                        <div className="h-full bg-[var(--state-success)] w-1/4 rounded-full" />
                    </div>
                </div>

                {/* Tasks Grid */}
                <div className="p-1 flex-1 overflow-visible">
                    {(() => {
                        const colsClass = {
                            3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                            4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                        }[cols]
                        return (
                            <div className={cn("grid gap-6", colsClass)}>
                                {filteredTasks.map((task) => (
                                    <TaskGridCard
                                        key={task.id}
                                        task={task}
                                        onOpen={openTask}
                                        onComplete={handleComplete}
                                        renderMenu={(t) => (
                                            <>
                                                {t.taskScope !== "LMS" && t.projectId ? <>
                                                    <DropdownMenuItem
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setQuickLogTask({
                                                                id: t.id,
                                                                name: t.name,
                                                                projectId: t.projectId as string,
                                                            })
                                                        }}
                                                        className="gap-2 text-sm font-medium cursor-pointer"
                                                    >
                                                        <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" /> Add Manual Time
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </> : null}
                                                <DropdownMenuItem
                                                    className="gap-2 text-sm font-medium text-[var(--state-urgent)] focus:text-[var(--state-urgent)] focus:bg-[var(--state-danger-surface)] cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (confirm("Delete this task?")) {
                                                            deleteTasks([t.id]).then(() => toast.success("Task deleted"))
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete Task
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    />
                                ))}

                                {/* Empty State */}
                                {filteredTasks.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center h-[220px] text-muted-foreground/50 gap-2 border-2 border-dashed border-muted/50 rounded-2xl bg-muted/5">
                                        <CheckCircle2 className="h-8 w-8 opacity-20" />
                                        <span className="text-xs font-medium">
                                            {filter === "high" ? "No high priority tasks!" : filter === "medium" ? "No medium priority tasks!" : filter === "low" ? "No low priority tasks!" : "All clear!"}
                                        </span>
                                    </div>
                                )}

                                {/* Shadow Task (Create New) */}
                                <div
                                    onClick={() => setCreateTaskOpen(true)}
                                    className="group flex flex-col items-center justify-center h-[160px] rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))] hover:bg-[var(--state-success-surface)] transition-all duration-300 cursor-pointer"
                                >
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 group-hover:bg-[var(--state-success)] group-hover:text-white transition-all duration-300">
                                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-current" strokeWidth={1.5} />
                                    </div>
                                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-[var(--state-success)] transition-colors mt-2">Add New Task</span>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            </div>
            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={projects || []}
            />
            {quickLogTask && quickLogTask.projectId && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => { if (!open) setQuickLogTask(null) }}
                    projectId={quickLogTask.projectId}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name || "Task"}
                />
            )}
        </>
    )
}
