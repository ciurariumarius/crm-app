"use client"

import * as React from "react"
import Link from "next/link"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { cn, formatProjectName } from "@/lib/utils"
import { ListChecks, ArrowRight, Clock, Trash2 } from "lucide-react"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { deleteTasks, updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { isPast, isToday } from "date-fns"
import { normalizeTaskUrgency } from "@/lib/status"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"

interface FocusMatrixProps {
    tasks: FocusTask[]
}

interface FocusTask {
    id: string
    name?: string | null
    status?: string | null
    urgency?: string | null
    deadline?: Date | string | null
    projectId?: string | null
    project?: {
        name?: string | null
        createdAt?: string | Date | null
        site?: { domainName?: string | null } | null
        services?: Array<{ serviceName?: string | null; isRecurring?: boolean | null }> | null
    } | null
}

const COLS = 3   // lg grid columns — must match grid class below
const ROWS = 3   // how many rows to show before "See all"
const VISIBLE_LIMIT = COLS * ROWS  // 9 cards
const URGENT_VISIBLE_CAP_WHEN_OVERDUE_EXISTS = 6
const OVERDUE_VISIBLE_CAP = 3

export function FocusMatrix({ tasks }: FocusMatrixProps) {
    const { openTask } = React.useContext(TaskSheetContext)
    const [quickLogTask, setQuickLogTask] = React.useState<{
        id: string
        name: string
        projectId: string
        project?: FocusTask["project"]
    } | null>(null)
    const [optimisticTasks, setOptimisticTasks] = React.useOptimistic(
        tasks,
        (state, updatedTaskId: string) => state.filter((task) => task.id !== updatedTaskId)
    )

    const isOverdueTask = (deadline: Date | string | null | undefined) => {
        if (!deadline) return false
        const date = new Date(deadline)
        if (Number.isNaN(date.getTime())) return false
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

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Delete this task?")) return
        React.startTransition(() => setOptimisticTasks(taskId))
        try {
            const result = await deleteTasks([taskId])
            if (result.success) {
                toast.success("Task deleted")
            } else {
                toast.error(result.error || "Failed to delete task")
            }
        } catch {
            toast.error("Process failed")
        }
    }

    const renderTaskActionMenu = (task: FocusTask) => (
        <>
            <DropdownMenuItem
                onClick={(e) => {
                    e.stopPropagation()
                    if (!task.projectId) {
                        toast.error("Task has no project")
                        return
                    }
                    setQuickLogTask({
                        id: task.id,
                        name: task.name || "Task",
                        projectId: task.projectId,
                        project: task.project ?? null,
                    })
                }}
                className="gap-2 text-sm font-medium cursor-pointer"
            >
                <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" /> Add Manual Time
            </DropdownMenuItem>
            <DropdownMenuItem
                className="gap-2 text-sm font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation()
                    void handleDeleteTask(task.id)
                }}
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete Task
            </DropdownMenuItem>
        </>
    )

    const getSortBucket = (task: FocusTask) => {
        const urgency = normalizeTaskUrgency(task.urgency)
        if (urgency === "Urgent") return 0
        if (isOverdueTask(task.deadline)) return 1
        return 2
    }

    // Sort: urgent first, then overdue, then everything else
    const sorted = [...optimisticTasks].sort((a, b) => {
        const bucketDiff = getSortBucket(a) - getSortBucket(b)
        if (bucketDiff !== 0) return bucketDiff

        // same bucket — sort by deadline asc, nulls/invalids last
        const aDateRaw = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const bDateRaw = b.deadline ? new Date(b.deadline).getTime() : Infinity
        const aDate = Number.isNaN(aDateRaw) ? Infinity : aDateRaw
        const bDate = Number.isNaN(bDateRaw) ? Infinity : bDateRaw
        if (aDate !== bDate) return aDate - bDate

        return (a.name ?? "").localeCompare(b.name ?? "")
    })

    const urgentTasks = sorted.filter((task) => getSortBucket(task) === 0)
    const overdueTasks = sorted.filter((task) => getSortBucket(task) === 1)
    const otherTasks = sorted.filter((task) => getSortBucket(task) === 2)

    const urgentCap = overdueTasks.length > 0 ? URGENT_VISIBLE_CAP_WHEN_OVERDUE_EXISTS : VISIBLE_LIMIT
    const urgentVisible = urgentTasks.slice(0, urgentCap)
    const overdueVisible = overdueTasks.slice(
        0,
        Math.min(OVERDUE_VISIBLE_CAP, VISIBLE_LIMIT - urgentVisible.length)
    )

    const visible = [...urgentVisible, ...overdueVisible]
    if (visible.length < VISIBLE_LIMIT) {
        const overflowUrgent = urgentTasks.slice(urgentVisible.length)
        const overflowOverdue = overdueTasks.slice(overdueVisible.length)
        const fillPool = [...overflowUrgent, ...overflowOverdue, ...otherTasks]
        visible.push(...fillPool.slice(0, VISIBLE_LIMIT - visible.length))
    }

    const hasMore = sorted.length > VISIBLE_LIMIT

    if (sorted.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30 border-2 border-dashed rounded-2xl bg-muted/5">
                <ListChecks className="h-8 w-8 mb-2 opacity-20" />
                <p className="ui-overline">No tasks found</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visible.map(task => (
                    <TaskGridCard
                        key={task.id}
                        task={task}
                        onOpen={openTask}
                        onComplete={() => handleComplete(task.id)}
                        renderMenu={renderTaskActionMenu}
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

            {quickLogTask && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => !open && setQuickLogTask(null)}
                    projectId={quickLogTask.projectId}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name}
                    projectName={quickLogTask.project ? formatProjectName(quickLogTask.project) : "Unknown Project"}
                />
            )}
        </div>
    )
}
