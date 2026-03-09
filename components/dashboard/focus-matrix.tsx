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

    const immediateAction = optimisticTasks.filter(t => t.urgency === 'Urgent' || isOverdueTask(t.deadline))
    const backlog = optimisticTasks.filter(t => !immediateAction.find(ia => ia.id === t.id))

    return (
        <div className="space-y-10">
            {/* Header / Section Title */}
            <div className="flex items-center gap-3 px-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Tasks</h3>
            </div>

            {/* Immediate Action Cluster */}
            {immediateAction.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-500">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <h4 className="font-bold text-lg tracking-tight">Immediate Action</h4>
                        <Badge variant="outline" className="ml-1 bg-red-50 text-red-600 border-red-200 text-[10px] py-0">
                            {immediateAction.length} Priority
                        </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Standard Tasks */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                        <ListChecks className="h-4 w-4" />
                    </div>
                    <h4 className="font-bold text-lg tracking-tight">Standard Tasks</h4>
                    <span className="text-sm font-medium text-muted-foreground ml-1">{backlog.length} items remaining</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground/30 border-2 border-dashed rounded-2xl bg-muted/5">
                            <ListChecks className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">No tasks found</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
