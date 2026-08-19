"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isToday, isPast } from "date-fns"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import { useDebounce } from "@/hooks/use-debounce"
import { deleteTasks, updateTasksStatus } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { Clock, Trash2, MoreVertical, Play, Pause, Square, Target, ArrowRight, Plus, Lightbulb, CalendarClock, AlertTriangle } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import { TASK_CARD_SHELL_CLASS, TaskGridCard } from "./task-grid-card"

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
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import { LmsIcon } from "@/components/lms/lms-icon"

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
    createdAt?: string | Date | null
    estimatedMinutes?: number | null
    timeLogs?: TimeLogSummary[] | null
    project?: TaskProjectSummary | null
    taskScope?: string | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null; defaultDurationMinutes?: number | null } | null
    lmsWorkEntry?: { id?: string; durationMinutes?: number | null } | null
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
    hourlyRate?: number
    searchApiFilters?: {
        status: string
        partnerId?: string
        projectId?: string
        taskId?: string
        urgency: string
        overdue: boolean
        dueToday: boolean
        scope?: string
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
    hourlyRate = 0,
    searchApiFilters,
}: TasksCardViewProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const { requestCompletion } = useTaskCompletion()
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
        const selectedTasks = tasks.filter((task) => selectedIds.includes(task.id))
        if (selectedTasks.some((task) => task.taskScope === "LMS")) {
            toast.error(status === "Completed"
                ? "Complete LMS tasks individually so you can confirm project, category, date, and time."
                : "Reopen LMS tasks individually to preserve their LMS work-entry history.")
            return
        }
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
        const task = visibleTasks.find((entry) => entry.id === taskId) || tasks.find((entry) => entry.id === taskId)
        if (!task) return
        requestCompletion(task, { onCompleted: () => router.refresh() })
    }

    const renderTaskActionMenu = (task: TaskCardViewTask) => (
        <>
            {task.taskScope !== "LMS" && task.projectId ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuickLogTask(task); }} className="gap-2 text-sm font-medium cursor-pointer">
                    <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" /> Add Manual Time
                </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className="gap-2 text-sm font-medium text-[var(--state-urgent)] focus:text-[var(--state-urgent)] focus:bg-[var(--state-danger-surface)] cursor-pointer" onClick={(e) => {
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
        if (status === "Active" || status === "Paused") return "bg-[var(--sidebar-accent)] text-[var(--primary)] border border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] dark:bg-[var(--sidebar-accent)] dark:text-[var(--primary)] dark:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))]"
        if (status === "Completed") return "bg-[var(--state-success-surface)] text-[var(--state-success)] border border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))] dark:bg-[var(--state-success-surface)] dark:text-[var(--state-success)] dark:border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))]"
        return "bg-muted text-muted-foreground border border-border"
    }

    const getUrgencyIcon = (urgency: string) => {
        const normalizedUrgency = normalizeTaskUrgency(urgency)
        if (normalizedUrgency === "Urgent") return <AlertTriangle className="h-4 w-4 fill-[var(--state-urgent)] text-white" />
        if (normalizedUrgency === "Idea") return <Lightbulb className="h-3 w-3" />
        return <ArrowRight className="h-3 w-3" strokeWidth={3} />
    }

    const gridClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

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
        params.set(
            "status",
            searchContext.statusRefined ? (searchApiFilters?.status || "Active") : "All"
        )
        params.set("urgency", searchApiFilters?.urgency || "all")
        params.set("sort", searchApiFilters?.sort || "newest")
        if (searchApiFilters?.overdue) params.set("overdue", "1")
        if (searchApiFilters?.dueToday) params.set("dueToday", "1")
        if (searchApiFilters?.partnerId) params.set("partnerId", searchApiFilters.partnerId)
        if (searchApiFilters?.projectId) params.set("projectId", searchApiFilters.projectId)
        if (searchApiFilters?.scope && searchApiFilters.scope !== "ALL") params.set("scope", searchApiFilters.scope)
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
        searchApiFilters?.scope,
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
                task.taskScope,
                task.lmsAllocation?.client,
                task.lmsTaskType?.name,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return fields.includes(normalizedSearch)
        })
    }, [normalizedSearch, remoteTasks, searchSourceTasks])

    const hasRefiningFilters = Boolean(
        normalizedSearch
        || (searchApiFilters?.status && searchApiFilters.status !== "Active")
        || searchApiFilters?.partnerId
        || searchApiFilters?.projectId
        || searchApiFilters?.taskId
        || (searchApiFilters?.urgency && searchApiFilters.urgency !== "all")
        || searchApiFilters?.overdue
        || searchApiFilters?.dueToday
        || (searchApiFilters?.scope && searchApiFilters.scope !== "ALL")
    )

    React.useEffect(() => {
        setSelectedTask((current) => {
            if (!current) return current
            // Prefer the latest server-rendered row after router.refresh(). Remote
            // search results can remain cached briefly and still contain the old target.
            return tasks.find((task) => task.id === current.id)
                || searchSourceTasks.find((task) => task.id === current.id)
                || current
        })
    }, [searchSourceTasks, tasks])

    const renderGridView = () => (
        <div className={cn("grid gap-5 2xl:gap-6", gridClass)} data-slot="tasks-grid">
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
                    className="h-full min-w-0"
                />
            ))}
            <button
                type="button"
                data-slot="add-task-card"
                aria-label="Add task"
                title="Add task"
                onClick={() => setCreateTaskOpen(true)}
                className={cn(
                    TASK_CARD_SHELL_CLASS,
                    "group min-w-0 items-center justify-center border-[color:color-mix(in_srgb,var(--line-subtle)_72%,transparent)] bg-transparent text-[var(--text-muted)] shadow-[0_2px_10px_rgba(15,23,42,0.025)] outline-none hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--primary)_24%,var(--line-subtle))] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_48%,transparent)] hover:text-[var(--primary)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.055)] focus-visible:bg-[color:color-mix(in_srgb,var(--surface-lowest)_48%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                )}
            >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] transition-transform duration-200 group-hover:scale-105">
                    <Plus className="h-6 w-6" strokeWidth={1.8} />
                </span>
            </button>
        </div>
    )

    const renderGridSkeleton = () => {
        const skeletonCount = 8
        return (
            <div className={cn("grid gap-5 2xl:gap-6", gridClass)}>
                {Array.from({ length: skeletonCount }).map((_, index) => (
                    <div
                        key={`tasks-grid-skeleton-${index}`}
                        className={cn(TASK_CARD_SHELL_CLASS, "p-4 sm:p-5")}
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
        <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4">
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
                    const sessionDuration = task.timeLogs?.reduce((acc: number, log: TimeLogSummary) => acc + (log.durationSeconds || 0), 0) || 0
                    const logsDuration = sessionDuration > 0
                        ? sessionDuration
                        : Math.max(0, task.lmsWorkEntry?.durationMinutes || 0) * 60
                    const isActiveTimerThisTask = timerState.taskId === task.id
                    const isRunning = isActiveTimerThisTask && timerState.isRunning
                    const isPaused = isActiveTimerThisTask && !timerState.isRunning
                    const currentTimerDuration = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
                    const totalSeconds = logsDuration + currentTimerDuration
                    const timeString = formatTimer(totalSeconds)
                    const isOverdue = task.deadline && isPast(new Date(task.deadline))
                    const isDueToday = task.deadline && isToday(new Date(task.deadline))
                    const activeHighlight = isRunning ? "text-[var(--primary)]" : "text-foreground"

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-5 shadow-[var(--shadow-apple)] transition-all duration-300 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:shadow-[var(--shadow-apple)] lg:flex-row lg:items-center lg:gap-6 lg:px-6",
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
                                {task.taskScope === "LMS" ? (
                                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] break-words whitespace-normal leading-tight">
                                        <LmsIcon className="h-4 w-4" />
                                        <span>{task.lmsAllocation?.client || "Project not linked"} · {task.lmsTaskType?.name || "Category not linked"}</span>
                                    </p>
                                ) : task.project ? (
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
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (task.status !== "Completed") {
                                                requestCompletion(task)
                                            }
                                        }}
                                        className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95", getStatusStyle(task.status || "Active"))}
                                        title={task.status === "Completed" ? "Task is completed" : "Click to complete task"}
                                    >
                                        {task.status || "Active"}
                                    </button>
                                </div>

                                <div className="flex w-auto shrink-0 lg:w-32 lg:justify-center">
                                    {task.deadline ? (
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-xs font-semibold tracking-tight uppercase",
                                            isOverdue ? "text-[var(--state-urgent)]" : "text-[var(--state-review)]"
                                        )}>
                                            {isOverdue ? <Clock className="w-3.5 h-3.5" /> : isDueToday ? <CalendarClock className="w-4 h-4" /> : <Target className="w-3.5 h-3.5" />}
                                            {isDueToday ? "TODAY" : format(new Date(task.deadline), "dd MMM")}
                                        </div>
                                    ) : (
                                        <div className="text-xs font-medium text-muted-foreground/30">-</div>
                                    )}
                                </div>

                                <div className="flex w-auto shrink-0 items-center justify-end gap-3.5 lg:w-48" onClick={e => e.stopPropagation()}>
                                    {task.taskScope === "LMS" ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-[var(--primary)]">LMS work</span>
                                            <span className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">Recorded on completion</span>
                                        </div>
                                    ) : <div className="flex flex-col items-end">
                                        <div className="text-sm font-bold tracking-tighter flex items-baseline gap-1">
                                            <span className={activeHighlight}>{timeString}</span>
                                            {task.estimatedMinutes && (
                                                <span className="text-muted-foreground/40 text-xs font-medium">/ {Math.floor(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}</span>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">Spent / Est</div>
                                    </div>}
                                    {task.taskScope !== "LMS" ? <div className="flex items-center gap-1.5 rounded-xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] p-1">
                                        <button
                                            type="button"
                                            aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : `Start timer for ${task.name}`}
                                            title={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                                            className={cn(
                                                "flex h-11 w-11 items-center justify-center rounded-[12px] transition-all sm:h-8 sm:w-8",
                                                isRunning ? "bg-[var(--state-warning-surface)] text-[var(--state-warning)]" : "bg-transparent text-muted-foreground hover:bg-background hover:shadow-sm"
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
                                                type="button"
                                                aria-label="Stop timer"
                                                title="Stop timer"
                                                className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--state-danger-surface)] text-[var(--state-urgent)] transition-all hover:brightness-[0.98] sm:h-8 sm:w-8"
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
                                    </div> : null}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    const renderListSkeleton = () => (
        <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4">
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`tasks-list-skeleton-${index}`}
                        className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-5 shadow-[var(--shadow-apple)]"
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
                            className="h-8 text-xs font-semibold text-[var(--state-urgent)] hover:bg-[var(--state-danger-surface)]"
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
                !hasRefiningFilters && view === "grid" ? renderGridView() : <div className="col-span-full flex h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] px-5 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                        <Clock className="h-5 w-5 text-[var(--text-muted)]" strokeWidth={1.6} />
                    </div>
                    <p className="mt-4 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                        {normalizedSearch
                              ? "No matching tasks"
                              : "No tasks for these filters"}
                    </p>
                    <p className="mt-1 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
                        {normalizedSearch
                              ? "Try a different search term or relax your filters to bring tasks back into view."
                              : "Adjust the current filters to broaden the task list."}
                    </p>
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
                <SheetContent side="right" showCloseButton={false} className={cn("z-[80]", sidePanelClass("default", 1))}>
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
