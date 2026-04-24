"use client"

import { useContext, useMemo, useState } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarDays, Loader2, Play, Plus } from "lucide-react"
import { addTask, toggleTaskStatus } from "@/lib/actions/tasks"
import { useTimer } from "@/components/providers/timer-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { normalizeTaskUrgency } from "@/lib/status"

type TaskWithLogs = {
    id: string
    name: string
    status: string
    urgency?: string | null
    deadline?: Date | string | null
    createdAt?: Date | string | null
    estimatedMinutes?: number | null
    timeLogs?: Array<{ durationSeconds?: number | null }>
}

function toDate(value: Date | string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function ProjectTasks({
    projectId,
    initialTasks,
}: {
    projectId: string
    initialTasks: TaskWithLogs[]
}) {
    const [newTaskName, setNewTaskName] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const { startTimer } = useTimer()
    const { openTask } = useContext(TaskSheetContext)
    const router = useRouter()

    const sortedTasks = useMemo(() => {
        return [...initialTasks].sort((a, b) => {
            if (a.status === "Completed" && b.status !== "Completed") return 1
            if (a.status !== "Completed" && b.status === "Completed") return -1
            const aDate = toDate(a.createdAt)?.getTime() ?? 0
            const bDate = toDate(b.createdAt)?.getTime() ?? 0
            return bDate - aDate
        })
    }, [initialTasks])

    const handleAddTask = async () => {
        const name = newTaskName.trim()
        if (!name) return

        setLoading("add")
        try {
            const result = await addTask(projectId, name)
            if (result.success) {
                setNewTaskName("")
                toast.success("Task added")
                router.refresh()
                return
            }
            toast.error(result.error || "Failed to add task")
        } catch {
            toast.error("Failed to add task")
        } finally {
            setLoading(null)
        }
    }

    const handleToggle = async (taskId: string, currentStatus: string) => {
        setLoading(taskId)
        try {
            const result = await toggleTaskStatus(taskId, currentStatus, projectId)
            if (!result.success) {
                toast.error(result.error || "Failed to update task")
                return
            }
            router.refresh()
        } catch {
            toast.error("Failed to update task")
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Input
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    placeholder="Type a task..."
                    className="h-14 rounded-2xl border-[var(--line-subtle)] bg-[var(--surface-low)]/70 pr-16 text-base placeholder:text-[var(--text-muted)]"
                />
                <Button
                    type="button"
                    size="icon"
                    onClick={handleAddTask}
                    disabled={loading === "add" || !newTaskName.trim()}
                    className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] shadow-sm hover:bg-[var(--surface-low)] hover:text-[var(--text-secondary)]"
                >
                    {loading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
            </div>

            <div className="space-y-2">
                {sortedTasks.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-low)]/70 px-4 py-5 text-center text-sm text-[var(--text-secondary)]">
                        No tasks yet. Add your first task above.
                    </div>
                )}

                {sortedTasks.map((task) => {
                    const dueDate = toDate(task.deadline) ?? toDate(task.createdAt)
                    const urgencyLabel = normalizeTaskUrgency(task.urgency).toUpperCase()
                    const isCompleted = task.status === "Completed"

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition",
                                isCompleted
                                    ? "border-[var(--line-subtle)] bg-[var(--surface-low)]/60"
                                    : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                            )}
                        >
                            <Checkbox
                                checked={isCompleted}
                                disabled={loading === task.id}
                                onCheckedChange={() => handleToggle(task.id, task.status)}
                                className="h-5 w-5 rounded-md border-[var(--line-subtle)]"
                            />

                            <button
                                type="button"
                                onClick={() => openTask(task.id)}
                                className="min-w-0 flex-1 text-left"
                            >
                                <p
                                    className={cn(
                                        "truncate text-base font-semibold leading-tight text-[var(--text-primary)]",
                                        isCompleted && "text-[var(--text-muted)] line-through"
                                    )}
                                >
                                    {task.name}
                                </p>
                            </button>

                            <div className="hidden items-center gap-2 sm:flex">
                                <span className="rounded-lg bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    {urgencyLabel}
                                </span>
                                {dueDate && (
                                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {format(dueDate, "MMM d")}
                                    </span>
                                )}
                            </div>

                            {!isCompleted && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => startTimer(projectId, task.id, task.name)}
                                    className="h-8 w-8 rounded-xl text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                </Button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
