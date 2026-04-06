"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateTask } from "@/lib/actions/tasks"
import { getProjectById } from "@/lib/actions/projects"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { TaskDetails, type TaskDetailsTask } from "@/components/tasks/task-details"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { sidePanelClass } from "@/lib/ui/side-panels"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"

type HomeTaskColumnsTask = TaskDetailsTask

interface HomeTaskColumnsProps {
    urgentTasks: HomeTaskColumnsTask[]
    overdueTasks: HomeTaskColumnsTask[]
    normalTasks: HomeTaskColumnsTask[]
    allServices: Service[]
    hourlyRate?: number
}

const HOME_MAX_VISIBLE_TASKS = 6

function uniqueById(tasks: HomeTaskColumnsTask[]) {
    const seen = new Set<string>()
    return tasks.filter((task) => {
        if (!task?.id || seen.has(task.id)) return false
        seen.add(task.id)
        return true
    })
}

function toTimestamp(value: Date | string | number | null | undefined, fallback: number) {
    if (value === null || value === undefined || value === "") return fallback
    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? fallback : parsed
}

export function HomeTaskColumns({ urgentTasks, overdueTasks, normalTasks, allServices, hourlyRate = 0 }: HomeTaskColumnsProps) {
    const [urgentState, setUrgentState] = React.useState<HomeTaskColumnsTask[]>(urgentTasks)
    const [overdueState, setOverdueState] = React.useState<HomeTaskColumnsTask[]>(overdueTasks)
    const [normalState, setNormalState] = React.useState<HomeTaskColumnsTask[]>(normalTasks)
    const [selectedTask, setSelectedTask] = React.useState<HomeTaskColumnsTask | null>(null)
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<Site & { partner?: { id: string; name: string } } | null>(null)
    const [isOpeningProject, setIsOpeningProject] = React.useState(false)

    React.useEffect(() => {
        setUrgentState(urgentTasks)
    }, [urgentTasks])

    React.useEffect(() => {
        setOverdueState(overdueTasks)
    }, [overdueTasks])

    React.useEffect(() => {
        setNormalState(normalTasks)
    }, [normalTasks])

    const overdueIds = React.useMemo(() => new Set(overdueState.map((task) => task.id)), [overdueState])
    const urgentIds = React.useMemo(() => new Set(urgentState.map((task) => task.id)), [urgentState])

    const mergedById = React.useMemo(() => {
        const map = new Map<string, HomeTaskColumnsTask>()
        for (const task of normalState) map.set(task.id, task)
        for (const task of overdueState) map.set(task.id, task)
        for (const task of urgentState) map.set(task.id, task)
        return map
    }, [normalState, overdueState, urgentState])

    const sortByPriority = React.useCallback(
        (left: HomeTaskColumnsTask, right: HomeTaskColumnsTask) => {
            const leftIsOverdue = overdueIds.has(left.id) ? 1 : 0
            const rightIsOverdue = overdueIds.has(right.id) ? 1 : 0
            if (leftIsOverdue !== rightIsOverdue) return rightIsOverdue - leftIsOverdue

            const leftDeadline = toTimestamp(left.deadline, Number.MAX_SAFE_INTEGER)
            const rightDeadline = toTimestamp(right.deadline, Number.MAX_SAFE_INTEGER)
            if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline

            const leftUpdated = toTimestamp(left.updatedAt, 0)
            const rightUpdated = toTimestamp(right.updatedAt, 0)
            if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated

            return toTimestamp(right.createdAt, 0) - toTimestamp(left.createdAt, 0)
        },
        [overdueIds]
    )

    const urgentOrdered = React.useMemo(() => {
        return uniqueById(
            urgentState
                .map((task) => mergedById.get(task.id) || task)
                .filter(Boolean)
        ).sort(sortByPriority)
    }, [mergedById, sortByPriority, urgentState])

    const overdueOnlyOrdered = React.useMemo(() => {
        return uniqueById(
            overdueState
                .map((task) => mergedById.get(task.id) || task)
                .filter((task) => !urgentIds.has(task.id))
                .filter(Boolean)
        ).sort(sortByPriority)
    }, [mergedById, overdueState, sortByPriority, urgentIds])

    const normalOnlyOrdered = React.useMemo(() => {
        return uniqueById(
            normalState
                .map((task) => mergedById.get(task.id) || task)
                .filter((task) => !urgentIds.has(task.id) && !overdueIds.has(task.id))
                .filter(Boolean)
        ).sort(sortByPriority)
    }, [mergedById, normalState, overdueIds, sortByPriority, urgentIds])

    const orderedTasks = React.useMemo(
        () => [...urgentOrdered, ...overdueOnlyOrdered],
        [overdueOnlyOrdered, urgentOrdered]
    )
    const visibleTasks = React.useMemo(() => {
        if (orderedTasks.length >= HOME_MAX_VISIBLE_TASKS) {
            return orderedTasks.slice(0, HOME_MAX_VISIBLE_TASKS)
        }
        const fillCount = HOME_MAX_VISIBLE_TASKS - orderedTasks.length
        return [...orderedTasks, ...normalOnlyOrdered.slice(0, fillCount)]
    }, [normalOnlyOrdered, orderedTasks])

    const handleOpenTask = React.useCallback(
        (taskId: string) => {
            const task = mergedById.get(taskId) || null
            setSelectedTask(task)
        },
        [mergedById]
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
            setNormalState((prev) => prev.filter((task) => task.id !== taskId))
            setSelectedTask((prev) => {
                if (!prev || prev.id !== taskId) return prev
                return { ...prev, status: "Completed" }
            })
            toast.success("Task marked as completed")
        } catch {
            toast.error("Failed to update task")
        }
    }, [])

    const handleOpenProjectFromTask = React.useCallback(async (project: { id?: string }) => {
        if (!project?.id) {
            toast.error("Project not found")
            return
        }
        setIsOpeningProject(true)
        try {
            const result = await getProjectById(project.id)
            if (!result.success || !result.data) {
                toast.error(result.error || "Failed to load project")
                return
            }
            setSelectedProject(result.data as ProjectWithDetails)
        } catch {
            toast.error("Failed to load project")
        } finally {
            setIsOpeningProject(false)
        }
    }, [])

    return (
        <div className="mb-6 w-full space-y-5 sm:mb-8 sm:space-y-8 lg:space-y-10">
            <section className="w-full">
                <div className="mb-5 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid grid-cols-3 gap-2 sm:gap-5">
                        <div className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 px-2 py-3 sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                            <span className="mt-0.5 h-2 w-2 rounded-full bg-rose-500" />
                            <p className="text-[22px] font-bold leading-none tracking-tight text-slate-900 sm:text-[32px]">{urgentState.length}</p>
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-rose-600 sm:text-[11px]">Urgent</p>
                        </div>

                        <div className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/50 px-2 py-3 sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:before:mr-5 sm:before:block sm:before:h-10 sm:before:w-px sm:before:bg-slate-200 sm:before:content-['']">
                            <span className="mt-0.5 h-2 w-2 rounded-full bg-orange-500" />
                            <p className="text-[22px] font-bold leading-none tracking-tight text-slate-900 sm:text-[32px]">{overdueState.length}</p>
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-orange-600 sm:text-[11px]">Overdue</p>
                        </div>

                        <div className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-2 py-3 sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:before:mr-5 sm:before:block sm:before:h-10 sm:before:w-px sm:before:bg-slate-200 sm:before:content-['']">
                            <span className="mt-0.5 h-2 w-2 rounded-full bg-slate-500" />
                            <p className="text-[22px] font-bold leading-none tracking-tight text-slate-900 sm:text-[32px]">{normalOnlyOrdered.length}</p>
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-slate-600 sm:text-[11px]">Normal</p>
                        </div>
                    </div>

                    <Link
                        href="/tasks?status=Active&urgency=Urgent&overdue=1"
                        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-100/80 bg-blue-50 px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-600 transition-colors hover:bg-blue-100 sm:w-auto"
                    >
                        View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {visibleTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        No active tasks.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        {visibleTasks.map((task) => (
                            <TaskGridCard
                                key={task.id}
                                task={task}
                                onOpen={handleOpenTask}
                                onComplete={handleComplete}
                                compact
                                className="h-full"
                            />
                        ))}
                    </div>
                )}
            </section>

            <TaskDetails
                task={selectedTask}
                open={Boolean(selectedTask)}
                onOpenChange={(open) => {
                    if (!open) setSelectedTask(null)
                }}
                panelStackLevel={0}
                onOpenProject={handleOpenProjectFromTask}
                onOpenSite={(site) => {
                    setSelectedSite(site as Site & { partner?: { id: string; name: string } })
                }}
            />

            <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" showCloseButton={false} className={cn("z-[80]", sidePanelClass("compact", 1))}>
                    {selectedProject ? (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onUpdate={(updated) => setSelectedProject(updated)}
                            onOpenSite={(site) => setSelectedSite(site)}
                            onClose={() => setSelectedProject(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>

            <Sheet open={Boolean(selectedSite)} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow", 2)}>
                    {selectedSite ? (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onClose={() => setSelectedSite(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>

            {isOpeningProject ? (
                <div className="pointer-events-none fixed inset-0 z-[79] bg-transparent" aria-hidden="true" />
            ) : null}
        </div>
    )
}
