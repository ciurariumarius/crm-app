"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { format, isToday, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { Clock, CheckCircle2, Target, Plus, LayoutGrid, Sparkles, Trash2 } from "lucide-react"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import Link from "next/link"
import { updateTask, deleteTasks } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { useTimer } from "@/components/providers/timer-provider"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

interface UpcomingTasksProps {
    tasks: any[]
    projects?: any[]
}

export function UpcomingTasks({ tasks, projects = [] }: UpcomingTasksProps) {
    const { timerState, startTimer, stopTimer, pauseTimer, resumeTimer } = useTimer()
    const { openTask } = React.useContext(TaskSheetContext)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [quickLogTask, setQuickLogTask] = React.useState<any>(null)
    const [cols, setCols] = React.useState<3 | 4>(3)
    const [filter, setFilter] = React.useState<"all" | "overdue" | "urgent">("all")
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
            case "overdue":
                return optimisticTasks.filter(t => t.deadline && isPast(new Date(t.deadline)) && !isToday(new Date(t.deadline)))
            case "urgent":
                return optimisticTasks.filter(t => t.urgency === "Urgent")
            default:
                return optimisticTasks
        }
    }, [optimisticTasks, filter])

    const handleComplete = async (taskId: string) => {
        // Optimistically remove
        React.startTransition(() => {
            setOptimisticTasks(taskId)
        })

        try {
            const result = await updateTask(taskId, { status: 'Completed' })
            if (result.success) {
                toast.success("Task completed")
            } else {
                toast.error("Failed to complete task")
            }
        } catch (error) {
            toast.error("An error occurred")
        }
    }



    // Progress Calculation
    const totalUrgent = tasks.filter(t => t.urgency === "Urgent").length
    const completedUrgentTasks = tasks.filter(t => t.urgency === "Urgent" && t.status === "Completed").length
    // Since we filter out completed tasks from the main list, we might need to rely on a prop or a separate fetch if we want to show *recently* completed urgent tasks in the count.
    // However, for "Your Today Work", typically we show remaining. 
    // If the requirement is "1 of 4 urgent tasks completed", we need the total count of urgent tasks for *today* regardless of completion.
    // Assuming 'tasks' prop passed to this component includes ONLY active tasks (based on previous code), 
    // we might not have the 'completed' count here without changing the parent fetch.
    // For now, I will use a placeholder logic or assume 'tasks' might eventually include completed ones if we change the fetch.
    // BUT, the prompt implies a design change, not necessarily a data fetch change yet. 
    // Let's stick to what we have: distinct visual feedback. 
    // Actually, looking at the image: "1 of 4 urgent tasks completed".
    // I will mock the "completed" count for now as 0 or calculate from what I have if possible, 
    // but the `upcomingTasks` query in `page.tsx` filters out completed.
    // I'll stick to a visual representation of "Urgent" tasks available.

    const urgentTasks = optimisticTasks.filter(t => t.urgency === "Urgent")
    const overdueTasks = optimisticTasks.filter(t => t.deadline && isPast(new Date(t.deadline)) && !isToday(new Date(t.deadline)))
    const dueTodayTasks = optimisticTasks.filter(t => t.deadline && isToday(new Date(t.deadline)))

    return (
        <>
            <div className="flex flex-col h-full bg-transparent overflow-hidden">
                {/* Header Section */}
                {/* Header Section */}
                <div className="py-4 px-1 flex flex-col gap-5">
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <Target className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                    Your Today Work
                                </h2>
                                <div className="flex items-center gap-2 mt-0.5 text-xs font-medium text-muted-foreground">
                                    <span className={cn(urgentTasks.length > 0 && "text-orange-500 font-bold")}>
                                        {urgentTasks.length} urgent
                                    </span>
                                    <span>•</span>
                                    <span className={cn(overdueTasks.length > 0 && "text-rose-500 font-bold")}>
                                        {overdueTasks.length} due
                                    </span>
                                    <span>•</span>
                                    <span className={cn(dueTodayTasks.length > 0 && "text-emerald-500 font-bold")}>
                                        {dueTodayTasks.length} for today
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Column switcher */}
                            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm gap-0.5">
                                {([3, 4] as const).map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => handleSetCols(c)}
                                        title={`${c} columns`}
                                        className={cn(
                                            "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                                            cols === c
                                                ? "bg-slate-100 text-slate-900"
                                                : "text-slate-400 hover:text-slate-700"
                                        )}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                            <Link href="/tasks" className="hidden md:block">
                                <Button variant="ghost" className="text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider">
                                    View All
                                </Button>
                            </Link>
                            <Button
                                size="icon"
                                className="h-10 w-10 bg-emerald-500 text-emerald-50 shadow-lg shadow-emerald-500/20 rounded-full hover:bg-emerald-600 hover:scale-105 transition-all"
                                onClick={() => setCreateTaskOpen(true)}
                            >
                                <Plus className="h-5 w-5" strokeWidth={3} />
                            </Button>
                        </div>
                    </div>

                    {/* Navigation Tabs - Notion Style */}
                    <div className="flex items-center gap-4 border-b border-border/40">
                        <button
                            onClick={() => setFilter("all")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-bold uppercase tracking-wider transition-all relative",
                                filter === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            All Tasks
                            {filter === "all" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground rounded-full" />}
                        </button>
                        <button
                            onClick={() => setFilter("overdue")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-bold uppercase tracking-wider transition-all relative",
                                filter === "overdue" ? "text-rose-600" : "text-muted-foreground hover:text-rose-600"
                            )}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            Overdue
                            {filter === "overdue" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-rose-600 rounded-full" />}
                        </button>
                        <button
                            onClick={() => setFilter("urgent")}
                            className={cn(
                                "flex items-center gap-2 px-1 py-2 text-xs font-bold uppercase tracking-wider transition-all relative",
                                filter === "urgent" ? "text-orange-600" : "text-muted-foreground hover:text-orange-600"
                            )}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            Urgent
                            {filter === "urgent" && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-orange-600 rounded-full" />}
                        </button>
                    </div>

                    {/* Progress Bar (Decoration) */}
                    <div className="h-1 w-full bg-emerald-500/10 rounded-full overflow-hidden -mt-2">
                        <div className="h-full bg-emerald-500 w-1/4 rounded-full" />
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
                                                <DropdownMenuItem
                                                    onClick={(e) => { e.stopPropagation(); setQuickLogTask(t); }}
                                                    className="gap-2 text-sm font-medium cursor-pointer"
                                                >
                                                    <Clock className="h-3.5 w-3.5 text-slate-400" /> Add Manual Time
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="gap-2 text-sm font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
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
                                            {filter === "overdue" ? "No overdue tasks!" : filter === "urgent" ? "No urgent tasks!" : "All clear for today!"}
                                        </span>
                                    </div>
                                )}

                                {/* Shadow Task (Create New) */}
                                <div
                                    onClick={() => setCreateTaskOpen(true)}
                                    className="group flex flex-col items-center justify-center h-[160px] rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-300 cursor-pointer"
                                >
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-current" strokeWidth={1.5} />
                                    </div>
                                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-emerald-500 transition-colors mt-2">Add New Task</span>
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
            {quickLogTask && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => { if (!open) setQuickLogTask(null) }}
                    projectId={quickLogTask.projectId || quickLogTask.project?.id || ""}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name}
                />
            )}
        </>
    )
}
