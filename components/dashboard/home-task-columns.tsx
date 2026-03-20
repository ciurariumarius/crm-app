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

type TaskColumnConfig = {
    key: "urgent" | "overdue"
    count: number
    page: number
    totalPages: number
    accentClass: string
    accentDot?: boolean
    viewAllHref: string
    visibleTasks: HomeTaskColumnsTask[]
    placeholderCount: number
    onPrev: () => void
    onNext: () => void
}

function TaskColumnHeader({
    config,
}: {
    config: TaskColumnConfig
}) {
    const isUrgent = config.key === "urgent"

    return (
        <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-start gap-3">
            <div className="flex items-start gap-2 leading-none">
                {config.accentDot ? <span className={`mt-[3px] h-1.5 w-1.5 rounded-full ${config.accentClass}`} /> : null}
                <div>
                    <p className="text-[40px] font-bold tracking-tight text-slate-900">{config.count}</p>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-[0.08em] ${isUrgent ? "text-rose-600" : "text-orange-600"}`}>
                        {isUrgent ? "Urgent" : "Overdue"}
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">Tasks</p>
                </div>
            </div>

            <div className="flex justify-center pt-1">
                <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
                    <button
                        type="button"
                        onClick={config.onPrev}
                        disabled={config.page === 1}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Previous ${config.key} tasks page`}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-[10px] font-semibold text-slate-500">
                        {config.page}/{config.totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={config.onNext}
                        disabled={config.page === config.totalPages}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Next ${config.key} tasks page`}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="pt-1 text-right">
                <Link
                    href={config.viewAllHref}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-600 hover:text-blue-500"
                >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </div>
    )
}

function TaskColumnGrid({
    tasks,
    placeholderCount,
    onOpen,
    onComplete,
}: {
    tasks: HomeTaskColumnsTask[]
    placeholderCount: number
    onOpen: (taskId: string) => void
    onComplete: (taskId: string) => void
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:auto-rows-[132px]">
            {tasks.map((task) => (
                <div key={task.id} className="sm:h-[132px]">
                    <TaskGridCard
                        task={task}
                        onOpen={onOpen}
                        onComplete={onComplete}
                        compact
                        className="h-full"
                    />
                </div>
            ))}

            {Array.from({ length: placeholderCount }).map((_, index) => (
                <div
                    key={`placeholder-${index}`}
                    aria-hidden="true"
                    className="invisible hidden rounded-2xl border border-transparent sm:block sm:h-[132px]"
                />
            ))}
        </div>
    )
}

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

    const urgentConfig: TaskColumnConfig = {
        key: "urgent",
        count: urgentState.length,
        page: urgentPage,
        totalPages: urgentTotalPages,
        accentClass: "bg-rose-500",
        accentDot: true,
        viewAllHref: "/tasks?status=Active&urgency=Urgent",
        visibleTasks: visibleUrgentTasks,
        placeholderCount: urgentPlaceholderCount,
        onPrev: () => setUrgentPage((prev) => Math.max(1, prev - 1)),
        onNext: () => setUrgentPage((prev) => Math.min(urgentTotalPages, prev + 1)),
    }

    const overdueConfig: TaskColumnConfig = {
        key: "overdue",
        count: overdueState.length,
        page: overduePage,
        totalPages: overdueTotalPages,
        accentClass: "bg-orange-500",
        viewAllHref: "/tasks?status=Active&overdue=1",
        visibleTasks: visibleOverdueTasks,
        placeholderCount: overduePlaceholderCount,
        onPrev: () => setOverduePage((prev) => Math.max(1, prev - 1)),
        onNext: () => setOverduePage((prev) => Math.min(overdueTotalPages, prev + 1)),
    }

    return (
        <>
            <section className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4 xl:pr-4">
                    <TaskColumnHeader config={urgentConfig} />
                    {urgentState.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No urgent active tasks.
                        </div>
                    ) : (
                        <TaskColumnGrid
                            tasks={urgentConfig.visibleTasks}
                            placeholderCount={urgentConfig.placeholderCount}
                            onOpen={openTask}
                            onComplete={handleComplete}
                        />
                    )}
                </div>

                <div className="space-y-4 xl:border-l xl:border-slate-200 xl:pl-6">
                    <TaskColumnHeader config={overdueConfig} />
                    {overdueState.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No overdue active tasks.
                        </div>
                    ) : (
                        <TaskColumnGrid
                            tasks={overdueConfig.visibleTasks}
                            placeholderCount={overdueConfig.placeholderCount}
                            onOpen={openTask}
                            onComplete={handleComplete}
                        />
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

