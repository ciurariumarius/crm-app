"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, FolderSearch } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { addTask, updateTask } from "@/lib/actions/tasks"
import { getProjectById } from "@/lib/actions/projects"
import { TaskGridCard } from "@/components/tasks/task-grid-card"
import { TaskDetails, type TaskDetailsTask } from "@/components/tasks/task-details"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { sidePanelClass } from "@/lib/ui/side-panels"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"

type HomeTaskColumnsTask = TaskDetailsTask
type HomeQuickCaptureProject = {
    id: string
    label: string
    domainName?: string | null
    createdAt?: Date | string | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }>
}

interface HomeTaskColumnsProps {
    urgentTasks: HomeTaskColumnsTask[]
    overdueTasks: HomeTaskColumnsTask[]
    normalTasks: HomeTaskColumnsTask[]
    quickCaptureProjects: HomeQuickCaptureProject[]
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

export function HomeTaskColumns({
    urgentTasks,
    overdueTasks,
    normalTasks,
    quickCaptureProjects,
    allServices,
    hourlyRate = 0,
}: HomeTaskColumnsProps) {
    const router = useRouter()
    const [urgentState, setUrgentState] = React.useState<HomeTaskColumnsTask[]>(urgentTasks)
    const [overdueState, setOverdueState] = React.useState<HomeTaskColumnsTask[]>(overdueTasks)
    const [normalState, setNormalState] = React.useState<HomeTaskColumnsTask[]>(normalTasks)
    const [quickTaskTitle, setQuickTaskTitle] = React.useState("")
    const [quickProjectId, setQuickProjectId] = React.useState("")
    const [quickProjectPickerOpen, setQuickProjectPickerOpen] = React.useState(false)
    const [isCreatingQuickTask, setIsCreatingQuickTask] = React.useState(false)
    const [recentTaskId, setRecentTaskId] = React.useState<string | null>(null)
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
    const baseVisibleTasks = React.useMemo(() => {
        if (orderedTasks.length >= HOME_MAX_VISIBLE_TASKS) {
            return orderedTasks.slice(0, HOME_MAX_VISIBLE_TASKS)
        }
        const fillCount = HOME_MAX_VISIBLE_TASKS - orderedTasks.length
        return [...orderedTasks, ...normalOnlyOrdered.slice(0, fillCount)]
    }, [normalOnlyOrdered, orderedTasks])
    const visibleTasks = React.useMemo(() => {
        if (!recentTaskId) return baseVisibleTasks
        const recentTask = mergedById.get(recentTaskId)
        if (!recentTask) return baseVisibleTasks
        if (baseVisibleTasks.some((task) => task.id === recentTaskId)) return baseVisibleTasks
        return [recentTask, ...baseVisibleTasks.slice(0, HOME_MAX_VISIBLE_TASKS - 1)]
    }, [baseVisibleTasks, mergedById, recentTaskId])

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

    const quickCaptureProjectMap = React.useMemo(() => {
        const map = new Map<string, HomeQuickCaptureProject>()
        for (const project of quickCaptureProjects) {
            map.set(project.id, project)
        }
        return map
    }, [quickCaptureProjects])

    React.useEffect(() => {
        if (!quickProjectId) return
        if (quickCaptureProjectMap.has(quickProjectId)) return
        setQuickProjectId("")
    }, [quickCaptureProjectMap, quickProjectId])

    const handleQuickCaptureSubmit = React.useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault()

        if (isCreatingQuickTask) return

        const title = quickTaskTitle.trim()
        if (!title) {
            toast.error("Task title is required")
            return
        }
        const selectedProject = quickProjectId ? quickCaptureProjectMap.get(quickProjectId) : null
        if (quickProjectId && !selectedProject) {
            toast.error("Selected project is no longer available")
            return
        }

        setIsCreatingQuickTask(true)
        try {
            const result = await addTask(quickProjectId || undefined, title)
            if (!result.success) {
                toast.error(result.error || "Failed to create task")
                return
            }

            const isGlobalTask = !result.data?.projectId
            const effectiveProjectId = result.data?.projectId || quickProjectId || null
            const effectiveProjectLabel = selectedProject?.label || result.data?.projectName || (isGlobalTask ? "Global task" : "Project")
            const effectiveDomainName = selectedProject?.domainName || result.data?.projectDomain || "No domain"
            const effectiveCreatedAt = selectedProject?.createdAt || new Date().toISOString()
            const effectiveServices = selectedProject?.services || []
            const temporaryTaskId = `quick-${crypto.randomUUID()}`
            const optimisticTask: HomeTaskColumnsTask = {
                id: temporaryTaskId,
                projectId: effectiveProjectId || undefined,
                name: title,
                description: "",
                status: "Active",
                urgency: "Normal",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                timeLogs: [],
                project: isGlobalTask
                    ? null
                    : {
                        id: effectiveProjectId || "global-task",
                        name: effectiveProjectLabel,
                        createdAt: effectiveCreatedAt,
                        site: {
                            domainName: effectiveDomainName,
                            partner: null,
                        },
                        services: effectiveServices.map((service) => ({
                            serviceName: service.serviceName || "",
                            isRecurring: service.isRecurring || false,
                        })),
                        tasks: [],
                        timeLogs: [],
                    },
            }

            setNormalState((prev) => [optimisticTask, ...prev.filter((task) => task.id !== temporaryTaskId)])
            setRecentTaskId(temporaryTaskId)
            setQuickTaskTitle("")
            toast.success(isGlobalTask ? "Global task created" : "Task created")
            router.refresh()
        } catch {
            toast.error("Failed to create task")
        } finally {
            setIsCreatingQuickTask(false)
        }
    }, [isCreatingQuickTask, quickTaskTitle, quickProjectId, quickCaptureProjectMap, router])

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
        <div className="w-full space-y-4.5 sm:space-y-6 lg:space-y-7">
            <section className="w-full">
                <div className="mb-3.5 flex items-center gap-2 sm:mb-5">
                    <div className="flex items-center gap-2">
                        <div className="h-[22px] w-[5px] rounded-full bg-blue-600" />
                        <h3 className="text-[17px] font-bold tracking-tight text-[var(--text-primary)]">Tasks</h3>
                    </div>
                </div>

                <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4">
                    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="grid grid-cols-3 gap-2 sm:gap-5">
                            <Link
                                href="/tasks?status=Active&urgency=Urgent"
                                className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-[color:color-mix(in_srgb,var(--state-urgent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_16%,transparent)] px-2 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--state-urgent)_22%,transparent)] sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
                            >
                                <span className="mt-0.5 h-2 w-2 rounded-full bg-[var(--state-urgent)]" />
                                <p className="text-[22px] font-bold leading-none tracking-tight text-[var(--text-primary)] sm:text-[32px]">{urgentState.length}</p>
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-[var(--state-urgent)] sm:text-[11px]">Urgent</p>
                            </Link>

                            <Link
                                href="/tasks?status=Active&overdue=1"
                                className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-[color:color-mix(in_srgb,var(--state-overdue)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_16%,transparent)] px-2 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--state-overdue)_22%,transparent)] sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:before:mr-5 sm:before:block sm:before:h-10 sm:before:w-px sm:before:bg-[var(--line-subtle)] sm:before:content-['']"
                            >
                                <span className="mt-0.5 h-2 w-2 rounded-full bg-[var(--state-overdue)]" />
                                <p className="text-[22px] font-bold leading-none tracking-tight text-[var(--text-primary)] sm:text-[32px]">{overdueState.length}</p>
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-[var(--state-overdue)] sm:text-[11px]">Overdue</p>
                            </Link>

                            <Link
                                href="/tasks?status=Active&urgency=Normal"
                                className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-2 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--surface-low)_94%,transparent)] sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:before:mr-5 sm:before:block sm:before:h-10 sm:before:w-px sm:before:bg-[var(--line-subtle)] sm:before:content-['']"
                            >
                                <span className="mt-0.5 h-2 w-2 rounded-full bg-[var(--text-muted)]" />
                                <p className="text-[22px] font-bold leading-none tracking-tight text-[var(--text-primary)] sm:text-[32px]">{normalOnlyOrdered.length}</p>
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-[var(--text-secondary)] sm:text-[11px]">Normal</p>
                            </Link>
                        </div>

                        <Link
                            href="/tasks?status=Active&urgency=Urgent&overdue=1"
                            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-100/80 bg-blue-50 px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-600 transition-colors hover:bg-blue-100 sm:w-auto"
                        >
                            View all <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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

                    <form
                        onSubmit={(event) => {
                            void handleQuickCaptureSubmit(event)
                        }}
                        className="flex h-full flex-col rounded-[16px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_86%,transparent)] p-2.5 shadow-[var(--shadow-apple)]"
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                value={quickTaskTitle}
                                onChange={(event) => setQuickTaskTitle(event.target.value)}
                                placeholder="Task title"
                                className="h-11 flex-1 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-[15px] font-semibold"
                                disabled={isCreatingQuickTask}
                            />
                            <Popover open={quickProjectPickerOpen} onOpenChange={setQuickProjectPickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        disabled={isCreatingQuickTask}
                                        className="h-9 w-9 shrink-0 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)]"
                                        aria-label="Select project (optional)"
                                    >
                                        <FolderSearch className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-[280px] rounded-xl p-0">
                                    <Command>
                                        <CommandInput placeholder="Search project..." />
                                        <CommandList className="max-h-[240px]">
                                            <CommandEmpty>No project found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="No project selected"
                                                    onSelect={() => {
                                                        setQuickProjectId("")
                                                        setQuickProjectPickerOpen(false)
                                                    }}
                                                    className="text-sm"
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", quickProjectId ? "opacity-0" : "opacity-100")} />
                                                    <span className="truncate">No project selected</span>
                                                </CommandItem>
                                                {quickCaptureProjects.map((project) => (
                                                    <CommandItem
                                                        key={project.id}
                                                        value={project.label}
                                                        onSelect={() => {
                                                            setQuickProjectId(project.id)
                                                            setQuickProjectPickerOpen(false)
                                                        }}
                                                        className="text-sm"
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", quickProjectId === project.id ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{project.label}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <Button
                            type="submit"
                            className="mt-2 h-9 rounded-xl text-sm font-semibold"
                            disabled={
                                isCreatingQuickTask ||
                                !quickTaskTitle.trim().length
                            }
                        >
                            {isCreatingQuickTask ? "Creating..." : "Create task"}
                        </Button>
                    </form>
                </div>

                {visibleTasks.length === 0 && (
                    <div className="mt-3 rounded-[14px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_78%,transparent)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                        No active tasks yet. Use quick capture to add one.
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
