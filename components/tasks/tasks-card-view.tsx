"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isToday, isPast } from "date-fns"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import { useDebounce } from "@/hooks/use-debounce"
import { addTask, deleteTasks, updateTasksStatus, updateTask } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { Clock, Trash2, MoreVertical, Play, Pause, Square, Target, ArrowRight, Plus, Lightbulb, CalendarClock, AlertTriangle, Check, FolderSearch } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import { TaskGridCard } from "./task-grid-card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

import { QuickTimeLogDialog } from "@/components/time/quick-time-log-dialog"

import { useTimer } from "@/components/providers/timer-provider"
import { useTasksSearchContext } from "./tasks-search-context"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"
import type { TaskDialogProject } from "./global-create-task-dialog"
import type { SearchPaginationState } from "@/types/search-pagination"
import { sidePanelClass } from "@/lib/ui/side-panels"

type TimeLogSummary = {
    id?: string
    durationSeconds?: number | null
    startTime?: string | Date | null
    endTime?: string | Date | null
    notes?: string | null
}

type TaskProjectSummary = {
    id?: string
    name?: string | null
    createdAt?: string | Date | null
    site?: {
        id?: string
        domainName?: string | null
        partner?: { id: string; name: string } | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
    tasks?: Array<{
        timeLogs?: TimeLogSummary[] | null
    }> | null
    timeLogs?: TimeLogSummary[] | null
}

type TaskCardViewTask = {
    id: string
    projectId?: string | null
    name?: string | null
    description?: string | null
    status?: string | null
    urgency?: string | null
    deadline?: string | Date | null
    estimatedMinutes?: number | null
    timeLogs?: TimeLogSummary[] | null
    project?: TaskProjectSummary | null
}

type SiteWithOptionalPartner = {
    id?: string
    domainName?: string | null
    partner?: { id: string; name: string } | null
    [key: string]: unknown
}

interface TasksCardViewProps {
    tasks: TaskCardViewTask[]
    allServices: Service[]
    initialActiveTimer?: unknown
    projects?: TaskDialogProject[]
    view?: "grid" | "list"
    cols?: number
    hourlyRate?: number
    searchApiFilters?: {
        status: string
        partnerId?: string
        projectId?: string
        taskId?: string
        urgency: string
        overdue: boolean
        dueToday: boolean
        sort: string
        page: number
        perPage: number
    }
}

export function TasksCardView({
    tasks,
    allServices,
    initialActiveTimer: _initialActiveTimer,
    projects = [],
    view = "grid",
    cols = 3,
    hourlyRate = 0,
    searchApiFilters,
}: TasksCardViewProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const router = useRouter()
    const searchParams = useSearchParams()
    const searchParamsString = searchParams.toString()
    const searchContext = useTasksSearchContext()
    void _initialActiveTimer
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<SiteWithOptionalPartner | null>(null)
    const [selectedTask, setSelectedTask] = React.useState<TaskCardViewTask | null>(null)
    const [quickLogTask, setQuickLogTask] = React.useState<TaskCardViewTask | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [isBulkOperating, setIsBulkOperating] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [quickTaskTitle, setQuickTaskTitle] = React.useState("")
    const [quickProjectId, setQuickProjectId] = React.useState("")
    const [quickProjectPickerOpen, setQuickProjectPickerOpen] = React.useState(false)
    const [isCreatingQuickTask, setIsCreatingQuickTask] = React.useState(false)
    const [remoteTasks, setRemoteTasks] = React.useState<TaskCardViewTask[] | null>(null)
    const searchCacheRef = React.useRef<
        Map<string, { tasks: TaskCardViewTask[]; total: number; pagination: SearchPaginationState }>
    >(new Map())

    const handleStartTimer = async (task: TaskCardViewTask) => {
        if (!task.projectId) {
            toast.error("Task has no project")
            return
        }
        await globalStartTimer(task.projectId, task.id, task.name || "Task")
    }

    const handleStopTimer = async () => {
        await globalStopTimer()
    }

    const handlePauseTimer = async () => {
        await globalPauseTimer()
    }

    const handleResumeTimer = async () => {
        await globalResumeTimer()
    }

    const formatTimer = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        return `${h > 0 ? `${h}h ` : ''}${m}m`
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} tasks?`)) return
        setIsBulkOperating(true)
        try {
            const result = await deleteTasks(selectedIds)
            if (result.success) {
                toast.success("Tasks deleted")
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to delete tasks")
            }
        } catch {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleBulkStatusUpdate = async (status: string) => {
        setIsBulkOperating(true)
        try {
            const result = await updateTasksStatus(selectedIds, status)
            if (result.success) {
                toast.success(`Tasks updated to ${status}`)
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to update tasks")
            }
        } catch {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleComplete = async (taskId: string) => {
        try {
            const result = await updateTask(taskId, { status: 'Completed' })
            if (result.success) {
                toast.success("Task completed")
            } else {
                toast.error(result.error || "Failed to complete task")
            }
        } catch {
            toast.error("Process failed")
        }
    }

    const renderTaskActionMenu = (task: TaskCardViewTask) => (
        <>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuickLogTask(task); }} className="gap-2 text-sm font-medium cursor-pointer">
                <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" /> Add Manual Time
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer" onClick={(e) => {
                e.stopPropagation()
                if (confirm("Delete this task?")) {
                    deleteTasks([task.id]).then(() => toast.success("Task deleted"))
                }
            }}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Task
            </DropdownMenuItem>
        </>
    )

    const getStatusStyle = (status: string) => {
        if (status === "Active" || status === "Paused") return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
        if (status === "Completed") return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
        return "bg-muted text-muted-foreground border border-border"
    }

    const getUrgencyIcon = (urgency: string) => {
        const normalizedUrgency = normalizeTaskUrgency(urgency)
        if (normalizedUrgency === "Urgent") return <AlertTriangle className="h-4 w-4 fill-[#F84444] text-white" />
        if (normalizedUrgency === "Idea") return <Lightbulb className="h-3 w-3" />
        return <ArrowRight className="h-3 w-3" strokeWidth={3} />
    }

    const colsClass = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    }[cols] ?? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

    const quickCaptureProjects = React.useMemo(() => {
        return projects
            .filter((project) => project.status === "Active")
            .map((project) => ({
                id: project.id,
                label: formatProjectName(project),
            }))
            .sort((left, right) => left.label.localeCompare(right.label))
    }, [projects])

    const quickCaptureProjectMap = React.useMemo(() => {
        const map = new Map<string, { id: string; label: string }>()
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

            setQuickTaskTitle("")
            toast.success(result.data?.projectId ? "Task created" : "Global task created")
            router.refresh()
        } catch {
            toast.error("Failed to create task")
        } finally {
            setIsCreatingQuickTask(false)
        }
    }, [isCreatingQuickTask, quickTaskTitle, quickProjectId, quickCaptureProjectMap, router])

    const normalizedSearch = (searchContext?.searchTerm || "").trim().toLowerCase()
    const debouncedSearch = useDebounce(normalizedSearch, 250)
    const showSearchSkeleton = Boolean(searchContext?.isSearching && debouncedSearch)

    React.useEffect(() => {
        if (!searchContext) return
        if (!debouncedSearch) {
            setRemoteTasks(null)
            searchContext.setSearchResultCount(null)
            searchContext.setSearchPagination(null)
            searchContext.setIsSearching(false)
            return
        }

        const params = new URLSearchParams()
        const locationParams = new URLSearchParams(searchParamsString)
        const locationPage = Number(locationParams?.get("page"))
        const effectivePage = Number.isFinite(locationPage) && locationPage > 0
            ? Math.floor(locationPage)
            : (searchApiFilters?.page || 1)
        const locationPerPage = Number(locationParams?.get("perPage"))
        const effectivePerPage = Number.isFinite(locationPerPage) && locationPerPage > 0
            ? Math.floor(locationPerPage)
            : (searchApiFilters?.perPage || 100)
        params.set("q", debouncedSearch)
        params.set("limit", "1000")
        params.set("page", String(effectivePage))
        params.set("perPage", String(effectivePerPage))
        params.set("status", searchApiFilters?.status || "Active")
        params.set("urgency", searchApiFilters?.urgency || "all")
        params.set("sort", searchApiFilters?.sort || "newest")
        if (searchApiFilters?.overdue) params.set("overdue", "1")
        if (searchApiFilters?.dueToday) params.set("dueToday", "1")
        if (searchApiFilters?.partnerId) params.set("partnerId", searchApiFilters.partnerId)
        if (searchApiFilters?.projectId) params.set("projectId", searchApiFilters.projectId)
        if (searchApiFilters?.taskId) params.set("taskId", searchApiFilters.taskId)

        const cacheKey = params.toString()
        const cached = searchCacheRef.current.get(cacheKey)
        if (cached) {
            setRemoteTasks(cached.tasks)
            searchContext.setSearchResultCount(cached.total)
            searchContext.setSearchPagination(cached.pagination)
            searchContext.setIsSearching(false)
            return
        }

        const controller = new AbortController()
        let cancelled = false
        searchContext.setIsSearching(true)

        void fetch(`/api/search/tasks?${cacheKey}`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
        })
            .then(async (response) => {
                if (!response.ok) return null
                return response.json()
            })
            .then((payload) => {
                if (cancelled || !payload?.success) return
                const nextTasks = Array.isArray(payload.tasks) ? (payload.tasks as TaskCardViewTask[]) : []
                const total = Number(payload.total || 0)
                const pagination = payload?.pagination as SearchPaginationState | undefined
                const safePagination: SearchPaginationState = pagination ?? {
                    total,
                    page: 1,
                    perPage: effectivePerPage,
                    totalPages: 1,
                    pageStart: total > 0 ? 1 : 0,
                    pageEnd: total,
                    shouldPaginate: false,
                    prevPage: null,
                    nextPage: null,
                }
                searchCacheRef.current.set(cacheKey, { tasks: nextTasks, total, pagination: safePagination })
                setRemoteTasks(nextTasks)
                searchContext.setSearchResultCount(total || nextTasks.length)
                searchContext.setSearchPagination(safePagination)
            })
            .catch((error) => {
                if (controller.signal.aborted) return
                console.error("Task search failed", error)
            })
            .finally(() => {
                if (cancelled) return
                searchContext.setIsSearching(false)
            })

        return () => {
            cancelled = true
            controller.abort()
        }
    }, [
        debouncedSearch,
        searchApiFilters?.dueToday,
        searchApiFilters?.overdue,
        searchApiFilters?.page,
        searchApiFilters?.partnerId,
        searchApiFilters?.perPage,
        searchApiFilters?.projectId,
        searchApiFilters?.taskId,
        searchApiFilters?.sort,
        searchApiFilters?.status,
        searchApiFilters?.urgency,
        searchParamsString,
        searchContext,
    ])

    const searchSourceTasks = remoteTasks ?? tasks
    const visibleTasks = React.useMemo(() => {
        if (!normalizedSearch) return searchSourceTasks
        if (remoteTasks) return remoteTasks
        return searchSourceTasks.filter((task) => {
            const fields = [
                task.name,
                task.description,
                task.status,
                task.urgency,
                task.project?.name,
                task.project?.site?.domainName,
                task.project?.site?.partner?.name,
                formatProjectName(task.project || {}),
                (task.project?.services || []).map((service) => service.serviceName || "").join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return fields.includes(normalizedSearch)
        })
    }, [normalizedSearch, remoteTasks, searchSourceTasks])

    const renderGridView = () => (
        <div className={cn("grid gap-3.5 sm:gap-4", colsClass)}>
            {visibleTasks.map((task) => (
                <TaskGridCard
                    key={task.id}
                    task={task}
                    onOpen={(taskId) => {
                        const found = visibleTasks.find(t => t.id === taskId)
                        if (found) setSelectedTask(found)
                    }}
                    onComplete={handleComplete}
                    renderMenu={renderTaskActionMenu}
                    isSelected={selectedIds.includes(task.id)}
                    onSelect={toggleSelect}
                    compact
                    className="h-full"
                />
            ))}

            <form
                onSubmit={(event) => {
                    void handleQuickCaptureSubmit(event)
                }}
                className="flex h-full flex-col rounded-[16px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_86%,transparent)] p-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.02)]"
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
    )

    const renderGridSkeleton = () => {
        const skeletonCount = cols >= 4 ? 8 : cols === 2 ? 4 : 6
        return (
            <div className={cn("grid gap-3.5 sm:gap-4", colsClass)}>
                {Array.from({ length: skeletonCount }).map((_, index) => (
                    <div
                        key={`tasks-grid-skeleton-${index}`}
                        className="rounded-[22px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)] sm:p-5"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="h-4 w-2/3 rounded bg-[var(--surface-low)]" />
                                <div className="h-6 w-16 rounded-lg bg-[var(--surface-low)]" />
                            </div>
                            <div className="h-3 w-1/2 rounded bg-[var(--surface-low)]" />
                            <div className="h-3 w-5/6 rounded bg-[var(--surface-low)]" />
                            <div className="flex items-center justify-between pt-2">
                                <div className="h-7 w-24 rounded-xl bg-[var(--surface-low)]" />
                                <div className="h-7 w-20 rounded-xl bg-[var(--surface-low)]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    const renderListView = () => (
        <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4">
            <div className="mb-3 hidden grid-cols-[auto_1fr_auto_auto_auto] gap-6 border-b border-[var(--line-subtle)] px-5 pb-3 pt-1 text-xs font-semibold text-muted-foreground lg:grid">
                <div className="flex w-16 items-center gap-6">
                    <span className="w-8 text-center">PRI</span>
                </div>
                <div>TASK / PROJECT / DESCRIPTION</div>
                <div className="w-24 text-center">STATUS</div>
                <div className="w-32 text-center">DEADLINE</div>
                <div className="w-48 text-right">TIME TRACKING</div>
            </div>

            <div className="flex flex-col gap-3">
                {visibleTasks.map((task) => {
                    const logsDuration = task.timeLogs?.reduce((acc: number, log: TimeLogSummary) => acc + (log.durationSeconds || 0), 0) || 0
                    const isActiveTimerThisTask = timerState.taskId === task.id
                    const isRunning = isActiveTimerThisTask && timerState.isRunning
                    const isPaused = isActiveTimerThisTask && !timerState.isRunning
                    const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
                    const totalSeconds = logsDuration + currentTimerDuration
                    const timeString = formatTimer(totalSeconds)
                    const isOverdue = task.deadline && isPast(new Date(task.deadline))
                    const isDueToday = task.deadline && isToday(new Date(task.deadline))
                    const activeHighlight = isRunning ? "text-blue-600" : "text-foreground"

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-5 shadow-[0_2px_10px_rgba(15,23,42,0.02)] transition-all duration-300 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:gap-6 lg:px-6",
                                selectedIds.includes(task.id) && "border-primary ring-2 ring-primary/20 bg-primary/5"
                            )}
                            onClick={() => setSelectedTask(task)}
                        >
                            {/* Mobile only elements implicitly stacked, Desktop uses precise widths */}
                            <div className="flex shrink-0 items-center gap-6 lg:w-16">
                                <div className="w-8 flex justify-center" title={task.urgency || undefined}>
                                    {getUrgencyIcon(task.urgency || "Normal")}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className={cn("text-base font-bold text-foreground/90 break-words whitespace-normal", task.status === "Completed" && "line-through opacity-50")}>
                                    {task.name}
                                </h3>
                                {task.project ? (
                                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)] break-words whitespace-normal leading-tight">
                                        {formatProjectName(task.project)}
                                    </p>
                                ) : null}
                                {task.description && (
                                    <p className="text-sm text-muted-foreground/70 truncate mt-1.5 hidden lg:block">
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            <div className="mt-3 flex shrink-0 items-center justify-between gap-5 lg:mt-0 lg:w-auto lg:justify-end lg:gap-6">
                                <div className="flex w-auto shrink-0 lg:w-24 lg:justify-center">
                                    <div className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", getStatusStyle(task.status || "Active"))}>
                                        {task.status || "Active"}
                                    </div>
                                </div>

                                <div className="flex w-auto shrink-0 lg:w-32 lg:justify-center">
                                    {task.deadline ? (
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-xs font-semibold tracking-tight uppercase",
                                            isOverdue ? "text-[#F84444]" : "text-blue-600"
                                        )}>
                                            {isOverdue ? <Clock className="w-3.5 h-3.5" /> : isDueToday ? <CalendarClock className="w-4 h-4" /> : <Target className="w-3.5 h-3.5" />}
                                            {isDueToday ? "TODAY" : format(new Date(task.deadline), "dd MMM")}
                                        </div>
                                    ) : (
                                        <div className="text-xs font-medium text-muted-foreground/30">-</div>
                                    )}
                                </div>

                                <div className="flex w-auto shrink-0 items-center justify-end gap-3.5 lg:w-48" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-col items-end">
                                        <div className="text-sm font-bold tracking-tighter flex items-baseline gap-1">
                                            <span className={activeHighlight}>{timeString}</span>
                                            {task.estimatedMinutes && (
                                                <span className="text-muted-foreground/40 text-[11px] font-medium">/ {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}</span>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">Spent / Est</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] p-1">
                                        <button
                                            className={cn(
                                                "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                                isRunning ? "bg-amber-500/20 text-amber-600" : "bg-transparent text-muted-foreground hover:bg-background hover:shadow-sm"
                                            )}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                if (isRunning) {
                                                    handlePauseTimer()
                                                } else if (isPaused) {
                                                    handleResumeTimer()
                                                } else {
                                                    handleStartTimer(task)
                                                }
                                            }}
                                        >
                                            {isRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                                        </button>

                                        {isActiveTimerThisTask && (
                                            <button
                                                className="h-7 w-7 rounded-lg flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleStopTimer()
                                                }}
                                            >
                                                <Square className="h-3 w-3 fill-current" />
                                            </button>
                                        )}

                                        {renderTaskActionMenu(task)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    const renderListSkeleton = () => (
        <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] p-3 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4">
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`tasks-list-skeleton-${index}`}
                        className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-5 shadow-[0_2px_10px_rgba(15,23,42,0.02)]"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="h-4 w-2/5 rounded bg-[var(--surface-low)]" />
                                <div className="h-6 w-20 rounded-lg bg-[var(--surface-low)]" />
                            </div>
                            <div className="h-3 w-3/5 rounded bg-[var(--surface-low)]" />
                            <div className="flex items-center justify-between pt-1">
                                <div className="h-3 w-28 rounded bg-[var(--surface-low)]" />
                                <div className="h-8 w-28 rounded-xl bg-[var(--surface-low)]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div className="space-y-5">
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="animate-in fade-in zoom-in flex items-center justify-between rounded-[20px] border border-primary/20 bg-[color:color-mix(in_srgb,var(--primary)_8%,var(--surface-lowest))] p-2 pl-4 duration-300 backdrop-blur-md">
                    <div className="flex items-center gap-6">
                        <span className="text-xs font-semibold text-primary">
                            {selectedIds.length} Selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-semibold bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Completed")}
                                disabled={isBulkOperating}
                            >
                                Complete
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs font-semibold bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Active")}
                                disabled={isBulkOperating}
                            >
                                Activate
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                            onClick={handleBulkDelete}
                            disabled={isBulkOperating}
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                            Delete
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setSelectedIds([])}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {showSearchSkeleton ? (
                view === "list" ? renderListSkeleton() : renderGridSkeleton()
            ) : visibleTasks.length === 0 ? (
                <div className="col-span-full flex h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] px-5 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                        <Clock className="h-5 w-5 text-[var(--text-muted)]" strokeWidth={1.6} />
                    </div>
                    <p className="mt-4 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                        {tasks.length === 0
                            ? "No tasks yet"
                            : normalizedSearch
                              ? "No matching tasks"
                              : "No tasks for these filters"}
                    </p>
                    <p className="mt-1 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
                        {tasks.length === 0
                            ? "Create your first task to start tracking delivery and time across projects."
                            : normalizedSearch
                              ? "Try a different search term or relax your filters to bring tasks back into view."
                              : "Adjust the current filters to broaden the task list."}
                    </p>
                    {tasks.length === 0 ? (
                        <Button
                            type="button"
                            onClick={() => setCreateTaskOpen(true)}
                            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="h-4 w-4" />
                            Add first task
                        </Button>
                    ) : null}
                </div>
            ) : (
                view === "list" ? renderListView() : renderGridView()
            )}

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
                panelStackLevel={0}
                onOpenProject={(project) => {
                    setSelectedProject(project as unknown as ProjectWithDetails)
                }}
                onOpenSite={(site) => {
                    setSelectedSite(site)
                }}
            />

            {/* Project Details Sheet */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" showCloseButton={false} className={cn("z-[80]", sidePanelClass("compact", 1))}>
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onUpdate={(updated) => setSelectedProject((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onOpenSite={(site) => setSelectedSite(site)}
                            onClose={() => setSelectedProject(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow", 2)}>
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite as Site & { partner?: { id: string; name: string } }}
                            onUpdate={(updated) => setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onClose={() => setSelectedSite(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Quick Time Log Dialog */}
            {quickLogTask && quickLogTask.projectId && (
                <QuickTimeLogDialog
                    open={!!quickLogTask}
                    onOpenChange={(open) => !open && setQuickLogTask(null)}
                    projectId={quickLogTask.projectId}
                    taskId={quickLogTask.id}
                    taskName={quickLogTask.name || "Task"}
                    projectName={quickLogTask.project ? formatProjectName(quickLogTask.project) : "Unknown Project"}
                />
            )}

            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={projects}
            />

        </div>
    )
}
