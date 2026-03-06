"use client"

import * as React from "react"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AlertCircle, Clock, ListChecks, LayoutGrid, Sparkles } from "lucide-react"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { isPast, isToday } from "date-fns"

interface FocusMatrixProps {
    tasks: any[]
}

export function FocusMatrix({ tasks }: FocusMatrixProps) {
    const { openTask } = React.useContext(TaskSheetContext)
    const [filter, setFilter] = React.useState<"all" | "overdue" | "urgent">("all")
    const [optimisticTasks, setOptimisticTasks] = React.useOptimistic(
        tasks,
        (state, updatedTaskId: string) => state.filter((task) => task.id !== updatedTaskId)
    )

    const isOverdueTask = (deadline: Date | string | null) => {
        if (!deadline) return false
        const date = new Date(deadline)
        return isPast(date) && !isToday(date)
    }

    const handleComplete = async (taskId: string) => {
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

    const filteredTasks = React.useMemo(() => {
        switch (filter) {
            case "overdue":
                return optimisticTasks.filter(t => isOverdueTask(t.deadline))
            case "urgent":
                return optimisticTasks.filter(t => t.urgency === "Urgent")
            default:
                return optimisticTasks
        }
    }, [optimisticTasks, filter])

    const immediateAction = filteredTasks.filter(t => t.urgency === 'Urgent' || isOverdueTask(t.deadline))
    const backlog = filteredTasks.filter(t => !immediateAction.find(ia => ia.id === t.id))

    return (
        <div className="space-y-10">
            {/* Header / Navigation style - Notion Inspired */}
            <div className="flex items-center gap-6 border-b border-border/40 pb-0">
                <button
                    onClick={() => setFilter("all")}
                    className={cn(
                        "flex items-center gap-2 px-1 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                        filter === "all"
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    All Tasks
                    {filter === "all" && (
                        <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground rounded-full" />
                    )}
                </button>
                <button
                    onClick={() => setFilter("overdue")}
                    className={cn(
                        "flex items-center gap-2 px-1 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                        filter === "overdue"
                            ? "text-rose-600"
                            : "text-muted-foreground hover:text-rose-600"
                    )}
                >
                    <Clock className="h-3.5 w-3.5" />
                    Overdue
                    {filter === "overdue" && (
                        <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-rose-600 rounded-full" />
                    )}
                </button>
                <button
                    onClick={() => setFilter("urgent")}
                    className={cn(
                        "flex items-center gap-2 px-1 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                        filter === "urgent"
                            ? "text-orange-600"
                            : "text-muted-foreground hover:text-orange-600"
                    )}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Urgent
                    {filter === "urgent" && (
                        <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-orange-600 rounded-full" />
                    )}
                </button>
            </div>

            {/* Immediate Action Cluster */}
            {immediateAction.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-500">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-lg tracking-tight">Immediate Action</h4>
                        <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 border-red-200">
                            {immediateAction.length} Priority
                        </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {immediateAction.map(task => (
                            <TaskGridCard
                                key={task.id}
                                task={task}
                                onOpen={openTask}
                                onComplete={() => handleComplete(task.id)}
                                className="border-l-4 border-l-red-500 shadow-sm"
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Normal Backlog */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                        <ListChecks className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-lg tracking-tight">Standard Backlog</h4>
                    <span className="text-sm font-medium text-muted-foreground ml-1">{backlog.length} items remaining</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {backlog.map(task => (
                        <TaskGridCard
                            key={task.id}
                            task={task}
                            onOpen={openTask}
                            onComplete={() => handleComplete(task.id)}
                            className="hover:border-primary/20 transition-colors"
                        />
                    ))}
                    {backlog.length === 0 && immediateAction.length === 0 && (
                        <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground/30 border-2 border-dashed rounded-2xl bg-muted/5">
                            <ListChecks className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">No tasks found</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
