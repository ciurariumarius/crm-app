"use client"

import * as React from "react"
import Link from "next/link"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { cn } from "@/lib/utils"
import { ListChecks, ArrowRight } from "lucide-react"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { isPast, isToday } from "date-fns"

interface FocusMatrixProps {
    tasks: FocusTask[]
}

interface FocusTask {
    id: string
    urgency?: string | null
    deadline?: Date | string | null
    [key: string]: unknown
}

const COLS = 3   // lg grid columns — must match grid class below
const ROWS = 3   // how many rows to show before "See all"
const VISIBLE_LIMIT = COLS * ROWS  // 9 cards

export function FocusMatrix({ tasks }: FocusMatrixProps) {
    const { openTask } = React.useContext(TaskSheetContext)
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
        React.startTransition(() => setOptimisticTasks(taskId))
        try {
            const result = await updateTask(taskId, { status: "Completed" })
            if (result.success) toast.success("Task completed")
            else toast.error("Failed to complete task")
        } catch {
            toast.error("An error occurred")
        }
    }

    // Sort: urgent/overdue first, then by deadline asc, then by name
    const sorted = [...optimisticTasks].sort((a, b) => {
        const aHot = a.urgency === "Urgent" || isOverdueTask(a.deadline)
        const bHot = b.urgency === "Urgent" || isOverdueTask(b.deadline)
        if (aHot && !bHot) return -1
        if (!aHot && bHot) return 1
        // both hot or both not — sort by deadline asc, nulls last
        const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity
        return aDate - bDate
    })

    const visible = sorted.slice(0, VISIBLE_LIMIT)
    const hasMore = sorted.length > VISIBLE_LIMIT

    if (sorted.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30 border-2 border-dashed rounded-2xl bg-muted/5">
                <ListChecks className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">No tasks found</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map(task => (
                    <TaskGridCard
                        key={task.id}
                        task={task}
                        onOpen={openTask}
                        onComplete={() => handleComplete(task.id)}
                    />
                ))}
            </div>

            {hasMore && (
                <Link
                    href="/tasks"
                    className={cn(
                        "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed",
                        "text-xs font-semibold transition-all duration-200",
                        "border-muted-foreground/20 text-muted-foreground/60",
                        "hover:border-emerald-400/50 hover:text-emerald-600 hover:bg-emerald-50/50"
                    )}
                >
                    <span>See all tasks</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            )}
        </div>
    )
}
