"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { updateTask } from "@/lib/actions/tasks"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { TaskDetails, type TaskDetailsTask } from "@/components/tasks/task-details"

type HomeTaskColumnsTask = TaskDetailsTask

interface HomeTaskColumnsProps {
    urgentTasks: HomeTaskColumnsTask[]
    overdueTasks: HomeTaskColumnsTask[]
}

const PAGE_SIZE = 4

export function HomeTaskColumns({ urgentTasks, overdueTasks }: HomeTaskColumnsProps) {
    const [urgentState, setUrgentState] = React.useState<HomeTaskColumnsTask[]>(urgentTasks)
    const [overdueState, setOverdueState] = React.useState<HomeTaskColumnsTask[]>(overdueTasks)
    const [selectedTask, setSelectedTask] = React.useState<HomeTaskColumnsTask | null>(null)
    const [urgentPage, setUrgentPage] = React.useState(1)
    const [overduePage, setOverduePage] = React.useState(1)

    React.useEffect(() => {
        setUrgentState(urgentTasks)
        setUrgentPage(1)
    }, [urgentTasks])

    React.useEffect(() => {
        setOverdueState(overdueTasks)
        setOverduePage(1)
    }, [overdueTasks])

    const urgentTotalPages = Math.max(1, Math.ceil(urgentState.length / PAGE_SIZE))
    const overdueTotalPages = Math.max(1, Math.ceil(overdueState.length / PAGE_SIZE))

    const visibleUrgentTasks = React.useMemo(() => {
        const start = (urgentPage - 1) * PAGE_SIZE
        return urgentState.slice(start, start + PAGE_SIZE)
    }, [urgentPage, urgentState])

    const visibleOverdueTasks = React.useMemo(() => {
        const start = (overduePage - 1) * PAGE_SIZE
        return overdueState.slice(start, start + PAGE_SIZE)
    }, [overduePage, overdueState])

    const urgentPlaceholderCount = Math.max(0, PAGE_SIZE - visibleUrgentTasks.length)
    const overduePlaceholderCount = Math.max(0, PAGE_SIZE - visibleOverdueTasks.length)

    const allVisibleTasks = React.useMemo(() => {
        const map = new Map<string, HomeTaskColumnsTask>()
        for (const task of [...urgentState, ...overdueState]) {
            map.set(task.id, task)
        }
        return Array.from(map.values())
    }, [overdueState, urgentState])

    const openTask = React.useCallback(
        (taskId: string) => {
            const found = allVisibleTasks.find((task) => task.id === taskId) || null
            setSelectedTask(found)
        },
        [allVisibleTasks]
    )

    const handleComplete = React.useCallback(async (taskId: string) => {
        try {
            const result = await updateTask(taskId, { status: "Completed" })
            if (!result.success) {
                toast.error(result.error || "Failed to update task")
                return
            }

            setUrgentState((prev) => prev.filter((task) => task.id !== taskId))
            setOverdueState((prev) => prev.filter((task) => task.id !== taskId))
            setSelectedTask((prev) => {
                if (!prev || prev.id !== taskId) return prev
                return { ...prev, status: "Completed" }
            })
            toast.success("Task marked as completed")
        } catch {
            toast.error("Failed to update task")
        }
    }, [])

    return (
        <>
            <section className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4 xl:pr-4">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold leading-none text-rose-700">{urgentState.length}</span>
                                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">Urgent</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {urgentState.length > PAGE_SIZE ? (
                                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setUrgentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={urgentPage === 1}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Previous urgent tasks page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="px-1 text-xs font-semibold text-slate-500">
                                        {urgentPage}/{urgentTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setUrgentPage((prev) => Math.min(urgentTotalPages, prev + 1))}
                                        disabled={urgentPage === urgentTotalPages}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Next urgent tasks page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                            <Link
                                href="/tasks?status=Active&urgency=Urgent"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500"
                            >
                                View all <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                    {urgentState.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No urgent active tasks.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {visibleUrgentTasks.map((task) => (
                                <div key={task.id}>
                                    <TaskGridCard
                                        task={task}
                                        onOpen={openTask}
                                        onComplete={handleComplete}
                                    />
                                </div>
                            ))}
                            {Array.from({ length: urgentPlaceholderCount }).map((_, index) => (
                                <div
                                    key={`urgent-placeholder-${urgentPage}-${index}`}
                                    aria-hidden="true"
                                    className="invisible hidden rounded-3xl border border-transparent sm:block"
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4 xl:border-l xl:border-slate-200 xl:pl-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold leading-none text-amber-700">{overdueState.length}</span>
                                <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-800">Overdue</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {overdueState.length > PAGE_SIZE ? (
                                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setOverduePage((prev) => Math.max(1, prev - 1))}
                                        disabled={overduePage === 1}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Previous overdue tasks page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="px-1 text-xs font-semibold text-slate-500">
                                        {overduePage}/{overdueTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setOverduePage((prev) => Math.min(overdueTotalPages, prev + 1))}
                                        disabled={overduePage === overdueTotalPages}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Next overdue tasks page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                            <Link
                                href="/tasks?status=Active&overdue=1"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500"
                            >
                                View all <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                    {overdueState.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No overdue active tasks.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {visibleOverdueTasks.map((task) => (
                                <div key={task.id}>
                                    <TaskGridCard
                                        task={task}
                                        onOpen={openTask}
                                        onComplete={handleComplete}
                                    />
                                </div>
                            ))}
                            {Array.from({ length: overduePlaceholderCount }).map((_, index) => (
                                <div
                                    key={`overdue-placeholder-${overduePage}-${index}`}
                                    aria-hidden="true"
                                    className="invisible hidden rounded-3xl border border-transparent sm:block"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <TaskDetails
                task={selectedTask}
                open={Boolean(selectedTask)}
                onOpenChange={(open) => {
                    if (!open) setSelectedTask(null)
                }}
            />
        </>
    )
}
