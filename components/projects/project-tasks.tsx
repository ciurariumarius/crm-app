"use client"

import { useContext, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Play, Plus } from "lucide-react"
import { addTask } from "@/lib/actions/tasks"
import { useTimer } from "@/components/providers/timer-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { normalizeTaskUrgency } from "@/lib/status"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import { TaskLmsFields, TaskTargetSelector, type TaskScopeValue } from "@/components/tasks/task-target-fields"

type TaskWithLogs = {
    id: string
    name: string
    status: string
    urgency?: string | null
    deadline?: Date | string | null
    createdAt?: Date | string | null
    estimatedMinutes?: number | null
    taskScope?: string | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null; defaultDurationMinutes?: number | null } | null
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
    const [newTaskScope, setNewTaskScope] = useState<TaskScopeValue>("FREELANCE")
    const [newTaskLmsAllocationId, setNewTaskLmsAllocationId] = useState("")
    const [newTaskLmsTaskTypeId, setNewTaskLmsTaskTypeId] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const { startTimer } = useTimer()
    const { requestCompletion, requestReopen } = useTaskCompletion()
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
            const result = await addTask(newTaskScope === "FREELANCE" ? projectId : undefined, name, {
                taskScope: newTaskScope,
                lmsAllocationId: newTaskScope === "LMS" ? newTaskLmsAllocationId || null : null,
                lmsTaskTypeId: newTaskScope === "LMS" ? newTaskLmsTaskTypeId || null : null,
            })
            if (result.success) {
                setNewTaskName("")
                toast.success(newTaskScope === "LMS" ? "LMS task added in Tasks" : "Task added")
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

    const handleToggle = (task: TaskWithLogs) => {
        setLoading(task.id)
        const done = () => {
            setLoading(null)
            router.refresh()
        }
        if (task.status === "Completed") {
            void requestReopen({ ...task, taskScope: task.taskScope || "FREELANCE" }, { onCompleted: done })
                .then((success) => { if (!success) setLoading(null) })
            return
        }
        requestCompletion({ ...task, taskScope: task.taskScope || "FREELANCE" }, { onCompleted: done })
    }

    return (
        <div className="space-y-3">
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void handleAddTask()
                }}
                className="space-y-3 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-low)]/50 p-3"
            >
                <TaskTargetSelector
                    value={newTaskScope}
                    onValueChange={setNewTaskScope}
                    disabled={loading === "add"}
                />
                {newTaskScope === "LMS" ? (
                    <TaskLmsFields
                        compact
                        lmsAllocationId={newTaskLmsAllocationId}
                        lmsTaskTypeId={newTaskLmsTaskTypeId}
                        onAllocationChange={setNewTaskLmsAllocationId}
                        onWorkTaskChange={setNewTaskLmsTaskTypeId}
                        disabled={loading === "add"}
                    />
                ) : (
                    <p className="text-xs text-[var(--text-muted)]">The task will be linked to this freelance project.</p>
                )}
                <div className="flex gap-2">
                    <Input
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        placeholder="Type a task..."
                        aria-label="Task name"
                        className="h-12 min-w-0 flex-1 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-base placeholder:text-[var(--text-muted)]"
                        disabled={loading === "add"}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        aria-label="Add task"
                        title="Add task"
                        disabled={loading === "add" || !newTaskName.trim()}
                        className="h-12 w-12 shrink-0 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] shadow-sm hover:bg-[var(--surface-low)] hover:text-[var(--text-secondary)]"
                    >
                        {loading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
            </form>

            <div className="space-y-2">
                {sortedTasks.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-low)]/70 px-4 py-5 text-center text-sm text-[var(--text-secondary)]">
                        No tasks yet. Add your first task above.
                    </div>
                )}

                {sortedTasks.map((task) => {
                    const priority = normalizeTaskUrgency(task.urgency)
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
                                onCheckedChange={() => handleToggle(task)}
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
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                    priority === "High" && "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400",
                                    priority === "Low" && "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 font-medium",
                                    priority === "Medium" && "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium"
                                )}>
                                    <span className={cn("h-1.5 w-1.5 rounded-full", priority === "High" ? "bg-rose-500" : priority === "Low" ? "bg-zinc-400" : "bg-amber-500")} />
                                    <span>{priority}</span>
                                </span>
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
