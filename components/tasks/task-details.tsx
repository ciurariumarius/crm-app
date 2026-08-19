"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, Check, Loader2, X, Play, Pause, Pencil, Plus, ArrowUpRight, FolderOpen, Globe, FileText, Info, MoreHorizontal, Trash2 } from "lucide-react"
import { updateTask, deleteTask, getTaskHistory, updateTasksStatus } from "@/lib/actions/tasks"
import { NOTES_WRITE_PROTOCOL_VERSION } from "@/lib/notes/write-protocol"
import { normalizeRichTextContent } from "@/lib/notes/content"
import { addTaskTimeEntry } from "@/lib/actions/time"
import { toast } from "sonner"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { useTimer } from "@/components/providers/timer-provider"
import { TimeTrackerWidget } from "@/components/shared/time-tracker-widget"
import { SidePanelManualTimeForm } from "@/components/shared/side-panel-manual-time-form"
import { SidePanelNotesSection } from "@/components/shared/side-panel-notes-section"
import { SidePanelTimeLogHistoryList } from "@/components/shared/side-panel-time-log-history-list"
import { normalizeExternalHttpUrl } from "@/lib/external-url"
import { useRouter } from "next/navigation"
import { SIDE_PANEL_DIALOG_HEADER_CLASS, sidePanelClass, sidePanelDialogContentClass, type SidePanelSize } from "@/lib/ui/side-panels"
import { SidePanelChip, SidePanelDetailRow, SidePanelInfoCard, SidePanelSectionTitle, SidePanelTabs } from "@/components/ui/side-panel-primitives"
import { TaskHistorySection, type TaskHistoryEntry } from "@/components/tasks/task-history-section"
import { TaskActualTimeQuickEdit } from "@/components/tasks/task-actual-time-quick-edit"
import { LmsIcon } from "@/components/lms/lms-icon"
import { TaskEstimatedTimeQuickEdit } from "@/components/tasks/task-estimated-time-quick-edit"
import { TaskFreelanceProjectField, TaskLmsFields, TaskTargetSelector, type TaskScopeValue } from "@/components/tasks/task-target-fields"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import {
    shouldApplyIncomingTaskTarget,
    taskTargetsEqual,
    type TaskTargetSnapshot,
} from "@/components/tasks/task-target-sync"
import { MAX_TASK_ESTIMATED_MINUTES, parseTaskEstimatedMinutesInput } from "@/lib/tasks/estimated-time"

type TaskTimeLog = {
    id?: string
    startTime?: string | Date | null
    endTime?: string | Date | null
    durationSeconds?: number | null
    notes?: string | null
}

type TaskDetailsSite = {
    id?: string
    domainName?: string | null
    partner?: { id: string; name: string } | null
    [key: string]: unknown
}

type TaskDetailsProject = {
    id?: string
    name?: string | null
    createdAt?: string | Date | null
    site?: TaskDetailsSite | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
    tasks?: Array<{
        id?: string
        name?: string | null
        timeLogs?: TaskTimeLog[] | null
    }> | null
    timeLogs?: TaskTimeLog[] | null
    [key: string]: unknown
}

function normalizeTaskTarget(task: TaskDetailsTask): TaskTargetSnapshot {
    const taskScope = task.taskScope === "LMS" || task.taskScope === "FREELANCE" || task.taskScope === "GENERAL"
        ? task.taskScope
        : task.projectId ? "FREELANCE" : "GENERAL"
    return {
        taskScope,
        projectId: taskScope === "FREELANCE" ? task.projectId || task.project?.id || "" : "",
        lmsAllocationId: taskScope === "LMS" ? task.lmsAllocationId || task.lmsAllocation?.id || "" : "",
        lmsTaskTypeId: taskScope === "LMS" ? task.lmsTaskTypeId || task.lmsTaskType?.id || "" : "",
    }
}

export type TaskDetailsTask = {
    id: string
    projectId?: string | null
    name?: string | null
    description?: string | null
    status?: string | null
    urgency?: string | null
    deadline?: string | Date | null
    createdAt?: string | Date | null
    updatedAt?: string | Date | null
    estimatedMinutes?: number | null
    taskScope?: TaskScopeValue | string | null
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
    lmsAllocation?: { id?: string; client?: string | null } | null
    lmsTaskType?: { id?: string; name?: string | null; isActive?: boolean | null; defaultDurationMinutes?: number | null } | null
    lmsWorkEntry?: { id?: string; durationMinutes?: number | null; workDate?: string | null; exportedAt?: string | Date | null } | null
    timeLogs?: TaskTimeLog[] | null
    project?: TaskDetailsProject | null
    [key: string]: unknown
}

interface TaskDetailsProps {
    task: TaskDetailsTask | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onOpenProject?: (project: TaskDetailsProject) => void
    onOpenSite?: (site: TaskDetailsSite) => void
    panelSize?: SidePanelSize
    panelStackLevel?: number
}

const TASK_NOTES_TEMPLATE = [
    "<h2>Context</h2>",
    "<p></p>",
    "<h2>Checklist</h2>",
    "<ul>",
    "<li></li>",
    "</ul>",
    "<h2>Screenshots</h2>",
    "<p></p>",
].join("")

function toDate(value: Date | string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatBottomDate(value: Date | null) {
    if (!value) return "—"
    return format(value, "dd MMMM yyyy, HH:mm")
}

export function TaskDetails({
    task,
    open,
    onOpenChange,
    onOpenProject,
    onOpenSite,
    panelSize = "compact",
    panelStackLevel = 0,
}: TaskDetailsProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const { requestCompletion, requestReopen, pendingTaskId, lmsOptions } = useTaskCompletion()
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)

    // Form state
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [status, setStatus] = React.useState("")
    const [urgency, setUrgency] = React.useState("")
    const [deadline, setDeadline] = React.useState<Date | undefined>(undefined)
    const [estimatedMinutes, setEstimatedMinutes] = React.useState("")
    const [taskScope, setTaskScope] = React.useState<TaskScopeValue>("GENERAL")
    const [projectId, setProjectId] = React.useState("")
    const [lmsAllocationId, setLmsAllocationId] = React.useState("")
    const [lmsTaskTypeId, setLmsTaskTypeId] = React.useState("")
    const [savedTarget, setSavedTarget] = React.useState<TaskTargetSnapshot>({
        taskScope: "GENERAL",
        projectId: "",
        lmsAllocationId: "",
        lmsTaskTypeId: "",
    })
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false)
    const [manualMinutes, setManualMinutes] = React.useState("")
    const [manualNotes, setManualNotes] = React.useState("")
    const [isLoggingTime, setIsLoggingTime] = React.useState(false)
    const [isNotesModalOpen, setIsNotesModalOpen] = React.useState(false)
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState("overview")
    const [isEditingDetails, setIsEditingDetails] = React.useState(false)
    const [taskHistory, setTaskHistory] = React.useState<TaskHistoryEntry[]>([])
    const [isLoadingTaskHistory, setIsLoadingTaskHistory] = React.useState(false)
    const [hasLoadedTaskHistory, setHasLoadedTaskHistory] = React.useState(false)
    const [notesSaveState, setNotesSaveState] = React.useState<"ready" | "typing" | "saving" | "error">("ready")
    const lastSavedDescriptionRef = React.useRef(normalizeRichTextContent(task?.description))
    const descriptionRef = React.useRef(normalizeRichTextContent(task?.description))

    // Sync form state with task
    const skipNextAutoSave = React.useRef(true)
    const selectedTaskIdRef = React.useRef<string | null>(null)
    const targetRevisionRef = React.useRef(0)
    const savedTargetRevisionRef = React.useRef(0)
    const savedTargetRef = React.useRef<TaskTargetSnapshot>({
        taskScope: "GENERAL",
        projectId: "",
        lmsAllocationId: "",
        lmsTaskTypeId: "",
    })
    const detailsBaselineRef = React.useRef({
        urgency: "Normal",
        deadlineTime: undefined as number | undefined,
        estimatedMinutes: "",
    })
    const awaitingTargetRefreshRef = React.useRef(false)
    const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
    const pendingSaveCountRef = React.useRef(0)
    const taskLoggedSeconds = React.useMemo(() => {
        const sessionSeconds = task?.timeLogs?.reduce(
            (total: number, log: TaskTimeLog) => total + Math.max(0, log.durationSeconds || 0),
            0
        ) || 0
        if (sessionSeconds > 0) return sessionSeconds
        return Math.max(0, task?.lmsWorkEntry?.durationMinutes || 0) * 60
    }, [task?.lmsWorkEntry?.durationMinutes, task?.timeLogs])
    const [displayTrackedSeconds, setDisplayTrackedSeconds] = React.useState(taskLoggedSeconds)

    React.useEffect(() => {
        setDisplayTrackedSeconds(taskLoggedSeconds)
    }, [task?.id, taskLoggedSeconds])

    React.useEffect(() => {
        if (!task) {
            selectedTaskIdRef.current = null
            return
        }

        const nextTarget = normalizeTaskTarget(task)
        const taskChanged = selectedTaskIdRef.current !== task.id
        const hasUnsavedTarget = targetRevisionRef.current !== savedTargetRevisionRef.current
        const applyIncomingTarget = shouldApplyIncomingTaskTarget({
            taskChanged,
            hasUnsavedTarget,
            awaitingSavedTarget: awaitingTargetRefreshRef.current,
            incomingTarget: nextTarget,
            savedTarget: savedTargetRef.current,
        })

        if (taskChanged) {
            selectedTaskIdRef.current = task.id
            targetRevisionRef.current = 0
            savedTargetRevisionRef.current = 0
            awaitingTargetRefreshRef.current = false
            setName(task.name || "")
            setDescription(normalizeRichTextContent(task.description))
            setStatus(normalizeTaskStatus(task.status))
            setUrgency(normalizeTaskUrgency(task.urgency))
            setDeadline(task.deadline ? new Date(task.deadline) : undefined)
            setEstimatedMinutes(task.estimatedMinutes == null ? "" : String(task.estimatedMinutes))
            detailsBaselineRef.current = {
                urgency: normalizeTaskUrgency(task.urgency),
                deadlineTime: task.deadline ? new Date(task.deadline).getTime() : undefined,
                estimatedMinutes: task.estimatedMinutes == null ? "" : String(task.estimatedMinutes),
            }
            setIsManualTimeOpen(false)
            setManualMinutes("")
            setManualNotes("")
            setIsEditingTitle(false)
            setIsEditingDetails(false)
            setActiveTab("overview")
            setTaskHistory([])
            setHasLoadedTaskHistory(false)
            const normalizedDescription = normalizeRichTextContent(task.description)
            lastSavedDescriptionRef.current = normalizedDescription
            descriptionRef.current = normalizedDescription
            setNotesSaveState("ready")
            skipNextAutoSave.current = true
        } else {
            // Status changes are action-driven, not part of the debounced form save.
            setStatus(normalizeTaskStatus(task.status))
        }

        if (applyIncomingTarget) {
            const awaitedTargetMatched = awaitingTargetRefreshRef.current
                && taskTargetsEqual(nextTarget, savedTargetRef.current)
            savedTargetRef.current = nextTarget
            if (awaitedTargetMatched) {
                awaitingTargetRefreshRef.current = false
            }
            setTaskScope(nextTarget.taskScope)
            setProjectId(nextTarget.projectId)
            setLmsAllocationId(nextTarget.lmsAllocationId)
            setLmsTaskTypeId(nextTarget.lmsTaskTypeId)
            setSavedTarget(nextTarget)
        }
    }, [task])

    const fetchTaskHistory = React.useCallback(async () => {
        if (!task?.id) return
        setIsLoadingTaskHistory(true)
        try {
            const result = await getTaskHistory(task.id)
            if (result.success) {
                setTaskHistory(result.data || [])
                setHasLoadedTaskHistory(true)
            }
        } catch (error) {
            console.error("Failed to load task history", error)
        } finally {
            setIsLoadingTaskHistory(false)
        }
    }, [task?.id])

    React.useEffect(() => {
        if (activeTab !== "activity" || hasLoadedTaskHistory || !task?.id) return
        void fetchTaskHistory()
    }, [activeTab, fetchTaskHistory, hasLoadedTaskHistory, task?.id])

    const currentTarget = React.useMemo<TaskTargetSnapshot>(() => ({
        taskScope,
        projectId: taskScope === "FREELANCE" ? projectId : "",
        lmsAllocationId: taskScope === "LMS" ? lmsAllocationId : "",
        lmsTaskTypeId: taskScope === "LMS" ? lmsTaskTypeId : "",
    }), [lmsAllocationId, lmsTaskTypeId, projectId, taskScope])
    const targetDirty = currentTarget.taskScope !== savedTarget.taskScope
        || currentTarget.projectId !== savedTarget.projectId
        || currentTarget.lmsAllocationId !== savedTarget.lmsAllocationId
        || currentTarget.lmsTaskTypeId !== savedTarget.lmsTaskTypeId
    const detailsDirty = targetDirty
        || urgency !== detailsBaselineRef.current.urgency
        || deadline?.getTime() !== detailsBaselineRef.current.deadlineTime
        || estimatedMinutes !== detailsBaselineRef.current.estimatedMinutes
    const parsedQuickEstimatedMinutes = parseTaskEstimatedMinutesInput(estimatedMinutes)
    const quickEstimatedMinutes = typeof parsedQuickEstimatedMinutes === "number"
        ? parsedQuickEstimatedMinutes
        : null
    const handleQuickEstimatedTimeSaved = React.useCallback((nextMinutes: number | null) => {
        const nextValue = nextMinutes == null ? "" : String(nextMinutes)
        setEstimatedMinutes(nextValue)
        detailsBaselineRef.current.estimatedMinutes = nextValue
        setHasLoadedTaskHistory(false)
    }, [])
    const bumpTargetRevision = React.useCallback(() => {
        targetRevisionRef.current += 1
    }, [])
    const projectActionsBlocked = loading || targetDirty
    const savedProjectId = savedTarget.taskScope === "FREELANCE" ? savedTarget.projectId : ""

    React.useEffect(() => {
        if (savedTarget.taskScope !== "FREELANCE") setIsManualTimeOpen(false)
    }, [savedTarget.taskScope])

    const handleUpdate = React.useCallback((): Promise<boolean> => {
        if (!task) return Promise.resolve(false)

        const parsedEstimatedMinutes = parseTaskEstimatedMinutesInput(estimatedMinutes)
        if (parsedEstimatedMinutes === undefined) {
            toast.error(`Planned time must be between 1 and ${MAX_TASK_ESTIMATED_MINUTES} minutes`)
            return Promise.resolve(false)
        }

        const taskId = task.id
        const saveRevision = targetRevisionRef.current
        const targetSnapshot = currentTarget
        const updateSnapshot = {
            urgency,
            deadline,
            estimatedMinutes: parsedEstimatedMinutes,
            taskScope,
            projectId: taskScope === "FREELANCE" ? projectId || null : null,
            lmsAllocationId: taskScope === "LMS" ? lmsAllocationId || null : null,
            lmsTaskTypeId: taskScope === "LMS" ? lmsTaskTypeId || null : null,
        }

        pendingSaveCountRef.current += 1
        setLoading(true)

        const queuedSave = saveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                try {
                    const result = await updateTask(taskId, updateSnapshot)

                    if (!result.success) {
                        toast.error(result.error || "Failed to update task")
                        return false
                    }

                    if (selectedTaskIdRef.current === taskId) {
                        savedTargetRevisionRef.current = saveRevision
                        savedTargetRef.current = targetSnapshot
                        awaitingTargetRefreshRef.current = true
                        setSavedTarget(targetSnapshot)
                        detailsBaselineRef.current = {
                            urgency,
                            deadlineTime: deadline?.getTime(),
                            estimatedMinutes,
                        }
                    }
                    toast.success("Task updated")
                    setHasLoadedTaskHistory(false)
                    setIsEditingDetails(false)

                    // A stale save must never refresh an older target over a newer
                    // local edit. The newest queued save owns the eventual refresh.
                    if (selectedTaskIdRef.current === taskId && saveRevision === targetRevisionRef.current) {
                        router.refresh()
                    }
                    return true
                } catch {
                    toast.error("Failed to update task")
                    return false
                } finally {
                    pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1)
                    if (pendingSaveCountRef.current === 0) setLoading(false)
                }
            })

        saveQueueRef.current = queuedSave.then(() => undefined, () => undefined)
        return queuedSave
    }, [currentTarget, deadline, estimatedMinutes, lmsAllocationId, lmsTaskTypeId, projectId, router, task, taskScope, urgency])

    const persistTaskDescription = React.useCallback(async (nextDescription: string) => {
        if (!task?.id || nextDescription === lastSavedDescriptionRef.current) return true
        setNotesSaveState("saving")
        try {
            const result = await updateTask(
                task.id,
                { description: nextDescription },
                { notesWriteProtocol: NOTES_WRITE_PROTOCOL_VERSION }
            )
            if (!result.success) {
                setNotesSaveState("error")
                toast.error(result.error || "Failed to update task notes")
                return false
            }
            lastSavedDescriptionRef.current = nextDescription
            setNotesSaveState("ready")
            return true
        } catch {
            setNotesSaveState("error")
            toast.error("Failed to update task notes")
            return false
        }
    }, [task?.id])

    const flushTaskNotesSave = React.useCallback(() => {
        void persistTaskDescription(descriptionRef.current)
    }, [persistTaskDescription])

    const handleTaskDescriptionChange = React.useCallback((value: string) => {
        const nextValue = normalizeRichTextContent(value)
        descriptionRef.current = nextValue
        setDescription(nextValue)
    }, [])

    React.useEffect(() => {
        if (!task?.id) return
        if (skipNextAutoSave.current) {
            skipNextAutoSave.current = false
            return
        }
        if (description === lastSavedDescriptionRef.current) {
            setNotesSaveState("ready")
            return
        }
        setNotesSaveState("typing")
        const timer = setTimeout(() => void persistTaskDescription(description), 650)
        return () => clearTimeout(timer)
    }, [description, persistTaskDescription, task?.id])

    React.useEffect(() => {
        const flushWhenHidden = () => {
            if (document.visibilityState === "hidden") flushTaskNotesSave()
        }
        window.addEventListener("pagehide", flushTaskNotesSave)
        document.addEventListener("visibilitychange", flushWhenHidden)
        return () => {
            window.removeEventListener("pagehide", flushTaskNotesSave)
            document.removeEventListener("visibilitychange", flushWhenHidden)
            flushTaskNotesSave()
        }
    }, [flushTaskNotesSave])

    const handleStatusChange = React.useCallback(async (nextStatus: "Active" | "Pending" | "Done") => {
        const normalizedCurrent = (status === "Completed" || status === "Done") ? "Done" : (status === "Pending" || status === "Paused") ? "Pending" : "Active"
        if (!task || nextStatus === normalizedCurrent || pendingTaskId === task.id || loading) return
        // Completion reads the persisted scope inside its transaction. Persist a newly
        // selected target first so a fast click cannot complete against stale mappings.
        if (targetDirty) {
            if (taskScope === "FREELANCE" && !projectId) {
                toast.error("Select a freelance project before changing the task status")
                return
            }
            if (!await handleUpdate()) return
        } else if (pendingSaveCountRef.current > 0) {
            // Completion must observe every queued edit before reading the task
            // target inside its transaction.
            await saveQueueRef.current
        }

        const taskWithCurrentTarget: TaskDetailsTask = {
            ...task,
            projectId: taskScope === "FREELANCE" ? projectId || null : null,
            taskScope,
            lmsAllocationId: lmsAllocationId || null,
            lmsTaskTypeId: lmsTaskTypeId || null,
        }
        if (nextStatus === "Done") {
            requestCompletion(taskWithCurrentTarget, {
                onCompleted: () => {
                    setStatus("Completed")
                    setHasLoadedTaskHistory(false)
                },
            })
            return
        }

        if (status === "Completed" || status === "Done") {
            const success = await requestReopen(taskWithCurrentTarget, {
                onCompleted: () => {
                    setStatus(nextStatus === "Pending" ? "Pending" : "Active")
                    setHasLoadedTaskHistory(false)
                },
            })
            if (success && nextStatus === "Pending") {
                await updateTasksStatus([task.id], "Pending")
                setStatus("Pending")
            }
            return
        }

        const res = await updateTasksStatus([task.id], nextStatus)
        if (res.success) {
            setStatus(nextStatus)
            toast.success(`Task marked ${nextStatus}`)
            setHasLoadedTaskHistory(false)
        }
    }, [handleUpdate, lmsAllocationId, lmsTaskTypeId, loading, pendingTaskId, projectId, requestCompletion, requestReopen, status, targetDirty, task, taskScope])

    const handleDelete = async () => {
        if (!task) return
        if (!window.confirm("Delete this task permanently?")) return
        try {
            const result = await deleteTask(task.id, savedProjectId || null)
            if (result.success) {
                toast.success("Task deleted")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to delete task")
            }
        } catch {
            toast.error("Failed to delete task")
        }
    }

    const appendTaskNotesTemplate = React.useCallback(() => {
        setDescription((current) => {
            const next = !current.trim() ? TASK_NOTES_TEMPLATE : `${current}<p></p>${TASK_NOTES_TEMPLATE}`
            descriptionRef.current = next
            return next
        })
    }, [])

    const createdTimestamp = toDate(task?.createdAt)
    const taskHistoryEntries = React.useMemo(() => {
        const hasCreated = taskHistory.some((entry) => entry.action === "TASK_CREATED")
        if (hasCreated || !createdTimestamp) return taskHistory
        return [
            ...taskHistory,
            {
                id: `task-created-${task?.id || "unknown"}`,
                action: "TASK_CREATED",
                date: createdTimestamp,
                source: "initial_create",
                status,
            },
        ].sort((left, right) => {
            const leftTime = toDate(left.date)?.getTime() || 0
            const rightTime = toDate(right.date)?.getTime() || 0
            return rightTime - leftTime
        })
    }, [taskHistory, createdTimestamp, task?.id, status])

    if (!task) return null
    const selectedLmsAllocationName = lmsOptions.allocations.find((option) => option.id === lmsAllocationId)?.client
        || (task.lmsAllocation?.id === lmsAllocationId ? task.lmsAllocation.client : undefined)
        || "Not linked"
    const selectedLmsTaskTypeName = lmsOptions.workTasks.find((option) => option.id === lmsTaskTypeId)?.name
        || (task.lmsTaskType?.id === lmsTaskTypeId ? task.lmsTaskType.name : undefined)
        || "Not linked"
    const isActiveTimerThisTask = timerState.taskId === task.id
    const isTaskRunning = isActiveTimerThisTask && timerState.isRunning
    const isTaskPaused = isActiveTimerThisTask && !timerState.isRunning
    const loggedSeconds = displayTrackedSeconds
    const runningSeconds = isActiveTimerThisTask ? timerState.elapsedSeconds : 0
    const totalTrackedSeconds = loggedSeconds + runningSeconds
    const timerDisplaySeconds = totalTrackedSeconds
    const loggedHours = Math.floor(loggedSeconds / 3600)
    const loggedMinutes = Math.floor((loggedSeconds % 3600) / 60)
    const timerStatusLabel = isTaskRunning ? "Running" : isTaskPaused ? "Paused" : "Ready"
    const sortedTimeLogs = [...(task.timeLogs || [])].sort((a: TaskTimeLog, b: TaskTimeLog) => {
        const aTime = toDate(a.startTime)?.getTime() ?? 0
        const bTime = toDate(b.startTime)?.getTime() ?? 0
        return bTime - aTime
    })
    const savedProjectMatchesTaskProp = Boolean(savedProjectId && task.project?.id === savedProjectId)
    const savedProjectOption = lmsOptions.projects.find((option) => option.id === savedProjectId)
    const projectLabel = savedProjectMatchesTaskProp
        ? formatProjectName(task.project || {})
        : savedProjectOption?.label || (savedProjectId ? "Saved project" : "Project")
    const projectPartnerLabel = savedProjectMatchesTaskProp ? task.project?.site?.partner?.name || "Partner" : "Refresh to load details"
    const projectDomainLabel = savedProjectMatchesTaskProp ? task.project?.site?.domainName || "Domain" : "Project changed"
    const projectDomainUrl = savedProjectMatchesTaskProp ? normalizeExternalHttpUrl(task.project?.site?.domainName) : null
    const projectSitePanelHref =
        savedProjectMatchesTaskProp && task.project?.site?.partner?.id && task.project?.site?.id
            ? `/partners/${task.project.site.partner.id}/${task.project.site.id}`
            : null
    const lastUpdatedTimestamp = toDate(task.updatedAt)

    const handleTaskTimerPrimaryAction = () => {
        if (isTaskRunning) {
            void globalPauseTimer()
            return
        }

        if (isTaskPaused) {
            void globalResumeTimer()
            return
        }

        if (projectActionsBlocked) {
            toast.message("Wait for the task target to finish saving")
            return
        }

        if (!savedProjectId) {
            toast.error("Task has no project")
            return
        }

        void globalStartTimer(savedProjectId, task.id, task.name || "Task")
    }

    const openProjectDetails = () => {
        if (projectActionsBlocked || !savedProjectId) return
        if (onOpenProject && savedProjectMatchesTaskProp) {
            onOpenProject({
                ...(task.project || {}),
                id: savedProjectId,
                tasks: task.project?.tasks || [],
                timeLogs: task.project?.timeLogs || [],
            })
            return
        }

        router.push(`/projects?openProject=${encodeURIComponent(savedProjectId)}`)
    }

    const openSitePanel = () => {
        if (projectActionsBlocked || !savedProjectMatchesTaskProp) return
        if (task.project?.site && onOpenSite) {
            onOpenSite(task.project.site)
            return
        }
        if (projectSitePanelHref) {
            router.push(projectSitePanelHref)
        }
    }

    const commitTitle = async () => {
        if (!task) return
        const nextName = name.trim()
        const persistedName = (task.name || "").trim()
        if (!nextName) {
            setName(task.name || "")
            setIsEditingTitle(false)
            return
        }
        if (nextName !== persistedName) {
            setLoading(true)
            try {
                const result = await updateTask(task.id, { name: nextName })
                if (!result.success) {
                    toast.error(result.error || "Failed to update task title")
                    setName(task.name || "")
                } else {
                    setName(nextName)
                    setHasLoadedTaskHistory(false)
                    router.refresh()
                }
            } catch {
                toast.error("Failed to update task title")
                setName(task.name || "")
            } finally {
                setLoading(false)
            }
        }
        setIsEditingTitle(false)
    }

    const cancelDetailsEdit = () => {
        setUrgency(detailsBaselineRef.current.urgency)
        setDeadline(detailsBaselineRef.current.deadlineTime ? new Date(detailsBaselineRef.current.deadlineTime) : undefined)
        setEstimatedMinutes(detailsBaselineRef.current.estimatedMinutes)
        setTaskScope(savedTarget.taskScope)
        setProjectId(savedTarget.projectId)
        setLmsAllocationId(savedTarget.lmsAllocationId)
        setLmsTaskTypeId(savedTarget.lmsTaskTypeId)
        targetRevisionRef.current = savedTargetRevisionRef.current
        setIsEditingDetails(false)
    }

    const requestLeaveDetailsEdit = () => {
        if (!isEditingDetails) return true
        if (detailsDirty && !window.confirm("Discard unsaved task detail changes?")) return false
        cancelDetailsEdit()
        return true
    }

    const handleTabChange = (nextTab: string) => {
        if (nextTab === activeTab) return true
        if (!requestLeaveDetailsEdit()) return false
        flushTaskNotesSave()
        setActiveTab(nextTab)
        return true
    }

    const handleSheetOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && !requestLeaveDetailsEdit()) return
        if (!nextOpen) flushTaskNotesSave()
        onOpenChange(nextOpen)
    }

    const handleManualLog = async () => {
        if (projectActionsBlocked) {
            toast.message("Wait for the task target to finish saving")
            return
        }

        const minutes = Number.parseInt(manualMinutes, 10)
        if (!manualMinutes || Number.isNaN(minutes) || minutes <= 0) {
            toast.error("Please enter a valid number of minutes")
            return
        }

        setIsLoggingTime(true)
        try {
            const response = await addTaskTimeEntry({
                taskId: task.id,
                minutes,
                description: manualNotes || undefined,
            })

            if (!response.success) {
                toast.error(response.error || "Failed to log time")
                return
            }

            toast.success("Time logged")
            setDisplayTrackedSeconds((current) => current + minutes * 60)
            setManualMinutes("")
            setManualNotes("")
            setIsManualTimeOpen(false)
            router.refresh()
        } catch {
            toast.error("Failed to log time")
        } finally {
            setIsLoggingTime(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={handleSheetOpenChange}>
            <SheetContent
                side="right"
                className={cn(sidePanelClass(panelSize, panelStackLevel), "overflow-hidden")}
                showCloseButton={false}
            >
                <SheetHeader className="relative z-20 border-b border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
                    <div className="absolute right-5 top-5 z-10 flex items-center gap-2 sm:right-8 sm:top-7">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                    aria-label="More task actions"
                                >
                                    <MoreHorizontal className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                                <DropdownMenuItem
                                    onSelect={() => void handleDelete()}
                                    className="cursor-pointer rounded-lg text-[var(--state-urgent)] focus:text-[var(--state-urgent)]"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete task
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            onClick={() => handleSheetOpenChange(false)}
                            aria-label="Close task"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="space-y-2 pr-28">
                        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {taskScope === "LMS" ? <LmsIcon className="h-5 w-5" /> : null}
                            <span>{taskScope === "LMS" ? "LMS task" : taskScope === "FREELANCE" ? "Freelance task" : "Legacy task"}</span>
                            <span aria-hidden="true">•</span>
                            <span className="truncate normal-case tracking-normal">
                                {taskScope === "LMS" ? selectedLmsAllocationName : taskScope === "FREELANCE" ? projectLabel : "No target"}
                            </span>
                        </div>
                        <SheetTitle className="group relative">
                            <div className="space-y-2">
                                <div className="relative">
                                    {isEditingTitle ? (
                                        <Textarea
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    commitTitle()
                                                }
                                                if (e.key === 'Escape') {
                                                    e.stopPropagation()
                                                    setName(task.name || "")
                                                    setIsEditingTitle(false)
                                                }
                                            }}
                                            onBlur={commitTitle}
                                            className="min-h-[44px] resize-none !rounded-none !border-0 !border-b !border-[var(--line-subtle)] !bg-transparent !px-0 !pb-1 !pt-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] !shadow-none focus-visible:!border-b-2 focus-visible:!border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] focus-visible:!ring-0 md:text-2xl"
                                            placeholder="Task Name"
                                            rows={1}
                                            autoFocus
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement
                                                target.style.height = 'auto'
                                                target.style.height = `${target.scrollHeight}px`
                                            }}
                                        />
                                    ) : (
                                        <div className="group flex w-full items-start gap-3 py-1">
                                            <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
                                                {name || task.name || "Untitled task"}
                                            </h1>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-lg text-[var(--text-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                                onClick={() => setIsEditingTitle(true)}
                                                disabled={loading}
                                                aria-label="Edit task title"
                                                title="Edit task title"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {loading && <Loader2 className="absolute right-0 top-1 h-5 w-5 animate-spin text-primary" />}
                                </div>
                            </div>
                        </SheetTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    disabled={loading || isEditingDetails || pendingTaskId === task.id}
                                    className={cn(
                                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                                        status === "Active"
                                            ? "border-[color:color-mix(in_srgb,var(--state-review)_25%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--state-review)_10%,var(--surface-lowest))] text-[var(--state-review)]"
                                            : (status === "Pending" || status === "Paused")
                                                ? "border-[color:color-mix(in_srgb,var(--state-warning)_25%,var(--line-subtle))] bg-[var(--state-warning-surface)] text-[var(--state-warning)]"
                                                : "border-[color:color-mix(in_srgb,var(--state-success)_25%,var(--line-subtle))] bg-[var(--state-success-surface)] text-[var(--state-success)]"
                                    )}
                                >
                                    {status === "Active" ? <Play className="h-3.5 w-3.5 fill-current" /> :
                                     (status === "Pending" || status === "Paused") ? <Pause className="h-3.5 w-3.5 fill-current" /> :
                                     <Check className="h-3.5 w-3.5" />}
                                    {(status === "Completed" || status === "Done") ? "Done" : (status === "Pending" || status === "Paused") ? "Pending" : "Active"}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40 rounded-xl p-1.5">
                                {([
                                    { label: "Active", value: "Active" },
                                    { label: "Pending", value: "Pending" },
                                    { label: "Done", value: "Done" },
                                ] as const).map((statusOption) => {
                                    const isCurrent = (statusOption.value === "Done" && (status === "Completed" || status === "Done"))
                                        || (statusOption.value === "Pending" && (status === "Pending" || status === "Paused"))
                                        || (statusOption.value === "Active" && status === "Active")
                                    return (
                                        <DropdownMenuItem
                                            key={statusOption.value}
                                            onSelect={() => void handleStatusChange(statusOption.value)}
                                            className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold"
                                        >
                                            <span className="flex items-center gap-2">
                                                {statusOption.value === "Active" ? <Play className="h-3.5 w-3.5 fill-current text-[var(--primary)]" /> :
                                                 statusOption.value === "Pending" ? <Pause className="h-3.5 w-3.5 fill-current text-[var(--state-warning)]" /> :
                                                 <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />}
                                                {statusOption.label}
                                            </span>
                                            {isCurrent ? <Check className="ml-auto h-4 w-4 text-[var(--primary)]" /> : null}
                                        </DropdownMenuItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </SheetHeader>

                <div className="z-10 overflow-x-auto border-b border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-2 sm:px-8">
                    <SidePanelTabs
                        ariaLabel="Task details"
                        value={activeTab}
                        onValueChange={handleTabChange}
                        tabs={[
                            { value: "overview", label: "Overview" },
                            { value: "notes", label: "Notes" },
                            { value: "time", label: "Time" },
                            { value: "activity", label: "Activity" },
                        ]}
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-8">
                    <div
                        role="tabpanel"
                        id={`task-details-${activeTab}-panel`}
                        aria-labelledby={`task-details-${activeTab}-tab`}
                        tabIndex={0}
                        className="space-y-6 pb-8 focus-visible:outline-none"
                    >
                        {activeTab === "overview" ? (
                            <>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Task details</h2>
                                        <p className="mt-1 text-sm text-[var(--text-muted)]">The information needed to place and complete this task.</p>
                                    </div>
                                    {!isEditingDetails ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsEditingDetails(true)}
                                            className="h-11 shrink-0 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4"
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit details
                                        </Button>
                                    ) : null}
                                </div>

                                {!isEditingDetails ? (
                                    <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 shadow-[var(--shadow-apple)]">
                                        <SidePanelDetailRow label="Target" value={taskScope === "LMS" ? "LMS" : taskScope === "FREELANCE" ? "Freelance" : "Not assigned"} />
                                        <SidePanelDetailRow label="Priority" value={urgency} />
                                        <SidePanelDetailRow label="Deadline" value={deadline ? format(deadline, "dd MMM yyyy") : "No deadline"} />
                                        <SidePanelDetailRow
                                            label="Tracked time"
                                            value={(
                                                <TaskActualTimeQuickEdit
                                                    taskId={task.id}
                                                    taskName={name}
                                                    totalSeconds={loggedSeconds}
                                                    onSaved={setDisplayTrackedSeconds}
                                                />
                                            )}
                                        />
                                        <SidePanelDetailRow
                                            label="Planned time"
                                            value={(
                                                <TaskEstimatedTimeQuickEdit
                                                    taskId={task.id}
                                                    taskName={name}
                                                    estimatedMinutes={quickEstimatedMinutes}
                                                    onSaved={handleQuickEstimatedTimeSaved}
                                                />
                                            )}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-5 rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 sm:p-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/priority relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-3 transition-all duration-300 active:scale-[0.98] sm:h-11 sm:px-4",
                                                urgency === "Urgent" && "border-[color:color-mix(in_srgb,var(--state-urgent)_25%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--state-urgent)_10%,var(--surface-lowest))] text-[var(--state-urgent)] hover:border-[var(--state-urgent)]",
                                                urgency === "Normal" && "border-[color:color-mix(in_srgb,var(--state-warning)_25%,var(--line-subtle))] bg-[var(--warning-surface)] text-[var(--warning-foreground)] hover:border-[var(--state-warning)]",
                                                urgency === "Idea" && "border-[color:color-mix(in_srgb,var(--state-review)_25%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--state-review)_10%,var(--surface-lowest))] text-[var(--state-review)] hover:border-[var(--state-review)]"
                                            )}
                                        >
                                            <div className="absolute inset-0 translate-y-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_22%,transparent)] transition-transform duration-300 group-hover/priority:translate-y-0" />
                                            <span className={cn(
                                                "relative z-10 h-2.5 w-2.5 rounded-full shadow-sm",
                                                urgency === "Urgent" && "bg-[var(--state-urgent)]",
                                                urgency === "Normal" && "bg-[var(--state-warning)]",
                                                urgency === "Idea" && "bg-[var(--brand-primary)]"
                                            )} />
                                            <span className="relative z-10 text-xs font-bold tracking-[0.01em] sm:text-[13px]">{urgency}</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-36 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                        {(["Urgent", "Normal", "Idea"] as const).map((urgencyOption) => (
                                            <DropdownMenuItem
                                                key={urgencyOption}
                                                onSelect={() => setUrgency(urgencyOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                            >
                                                <span className={cn(
                                                    "mr-2 h-2 w-2 rounded-full",
                                                    urgencyOption === "Urgent" && "bg-[var(--state-urgent)]",
                                                    urgencyOption === "Normal" && "bg-[var(--state-warning)]",
                                                    urgencyOption === "Idea" && "bg-[var(--brand-primary)]"
                                                )} />
                                                {urgencyOption}
                                                {urgency === urgencyOption && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex flex-col justify-center">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/deadline relative flex h-10 w-full items-center justify-between overflow-hidden rounded-full border px-3 shadow-[var(--shadow-apple)] transition-all duration-300 active:scale-[0.98] sm:h-11 sm:px-4",
                                                deadline
                                                    ? "border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] bg-[var(--sidebar-accent)] text-[var(--primary)] hover:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))]"
                                                    : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                            )}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate text-xs font-bold tracking-[0.01em] sm:text-[13px]">
                                                    {deadline ? format(deadline, "dd MMM yyyy") : "Set deadline"}
                                                </span>
                                            </span>
                                            <span className="ml-2 inline-flex shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_80%,transparent)] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                                {deadline ? format(deadline, "EEE") : "None"}
                                            </span>
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto rounded-xl p-0 pointer-events-auto" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={deadline}
                                            onSelect={setDeadline}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <section className="space-y-2 border-t border-[var(--line-subtle)] pt-5">
                            <div className="flex items-center justify-between gap-3">
                                <SidePanelSectionTitle title="Planned time" icon={<Clock className="h-3.5 w-3.5" />} />
                                <span className="text-xs font-medium text-[var(--text-muted)]">
                                    {taskScope === "LMS" ? "Completion default" : "Estimate"}
                                </span>
                            </div>
                            <div className="relative max-w-52">
                                <Input
                                    id="task-estimated-minutes"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={MAX_TASK_ESTIMATED_MINUTES}
                                    step={1}
                                    value={estimatedMinutes}
                                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                                    placeholder="ex. 60"
                                    aria-label="Planned time in minutes"
                                    className={cn(
                                        "h-11 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-low)] pr-14 font-semibold",
                                        parseTaskEstimatedMinutesInput(estimatedMinutes) === undefined && "border-[var(--state-urgent)]"
                                    )}
                                    disabled={loading}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">
                                    min
                                </span>
                            </div>
                            <p className="text-xs leading-5 text-[var(--text-muted)]">
                                Leave empty for no estimate. LMS uses this value as the suggested duration when completing the task.
                            </p>
                        </section>

                        <section className="space-y-3 border-t border-[var(--line-subtle)] pt-5">
                            <div className="flex items-center justify-between gap-3">
                                <SidePanelSectionTitle title="Task target" icon={<FolderOpen className="h-3.5 w-3.5" />} />
                                <span className="text-xs font-medium text-[var(--text-muted)]">
                                    {taskScope === "LMS" ? "Shared with LMS" : taskScope === "FREELANCE" ? "Freelance workflow" : "Choose a target"}
                                </span>
                            </div>
                            <TaskTargetSelector
                                value={taskScope}
                                disabled={loading || pendingTaskId === task.id || status === "Completed"}
                                onValueChange={(value) => {
                                    if (value !== "FREELANCE" && isActiveTimerThisTask) {
                                        toast.error("Stop the active freelance timer before removing this task from its project")
                                        return
                                    }
                                    if (value !== taskScope) bumpTargetRevision()
                                    setTaskScope(value)
                                }}
                            />
                            {taskScope === "FREELANCE" ? (
                                <TaskFreelanceProjectField
                                    projectId={projectId}
                                    onProjectChange={(value) => {
                                        if (isActiveTimerThisTask && value !== projectId) {
                                            toast.error("Stop the active timer before moving this task to another project")
                                            return
                                        }
                                        if (value !== projectId) bumpTargetRevision()
                                        setProjectId(value)
                                    }}
                                    disabled={loading || pendingTaskId === task.id || status === "Completed"}
                                />
                            ) : taskScope === "LMS" ? (
                                <TaskLmsFields
                                    lmsAllocationId={lmsAllocationId}
                                    lmsTaskTypeId={lmsTaskTypeId}
                                    onAllocationChange={(value) => {
                                        if (value !== lmsAllocationId) bumpTargetRevision()
                                        setLmsAllocationId(value)
                                    }}
                                    onWorkTaskChange={(value) => {
                                        if (value !== lmsTaskTypeId) bumpTargetRevision()
                                        setLmsTaskTypeId(value)
                                    }}
                                    disabled={loading || pendingTaskId === task.id || status === "Completed"}
                                    compact
                                />
                            ) : null}
                            {targetDirty ? <p className="text-xs font-medium text-[var(--text-muted)]">Unsaved target change</p> : null}
                            {taskScope === "GENERAL" ? (
                                <p className="text-xs leading-5 text-[var(--state-urgent)]">This is a legacy no-project task. Choose Freelance or LMS; use your Personal freelance project for standalone work.</p>
                            ) : null}
                            {status === "Completed" ? (
                                <p className="text-xs leading-5 text-[var(--text-muted)]">Reopen the task before changing its target or LMS links. Existing LMS work remains historical.</p>
                            ) : taskScope === "LMS" ? (
                                <p className="text-xs leading-5 text-[var(--text-muted)]">Both LMS fields can be completed later. They become required when the task is marked completed.</p>
                            ) : null}
                        </section>
                                    </div>
                                )}
                            </>
                        ) : null}

                        {activeTab === "notes" ? <SidePanelNotesSection
                            title="Task notes"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            statusLabel={notesSaveState === "typing" ? "Typing" : notesSaveState === "saving" ? "Saving" : "Ready"}
                            statusTone={notesSaveState === "saving" ? "blue" : notesSaveState === "typing" ? "amber" : "emerald"}
                            statusState={notesSaveState}
                            value={description}
                            onChange={handleTaskDescriptionChange}
                            onBlur={flushTaskNotesSave}
                            uploadProjectId={savedProjectId || task.id}
                            imageUploadsDisabled={projectActionsBlocked}
                            onAddTemplate={appendTaskNotesTemplate}
                            onExpand={() => setIsNotesModalOpen(true)}
                            expandLabel="Open notes in full view"
                            className="border-t-0 pt-0"
                            minHeightClassName="min-h-[calc(100dvh-310px)] sm:min-h-[520px]"
                        /> : null}

                    {activeTab === "time" ? (taskScope !== "LMS" ? <section className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <SidePanelSectionTitle title="Task time tracker" icon={<Clock className="h-3.5 w-3.5" />} />
                                <div className="flex items-center gap-2">
                                    <TaskActualTimeQuickEdit
                                        taskId={task.id}
                                        taskName={name}
                                        totalSeconds={loggedSeconds}
                                        onSaved={setDisplayTrackedSeconds}
                                        disabled={projectActionsBlocked}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsManualTimeOpen((current) => !current)}
                                        disabled={projectActionsBlocked}
                                        className="h-8 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 ui-text-caption text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                    >
                                        <Plus className="mr-1 h-3.5 w-3.5" />
                                        Add Time
                                    </Button>
                                </div>
                            </div>
                            <TimeTrackerWidget
                                totalTrackedHours={loggedHours}
                                totalTrackedMinutes={loggedMinutes}
                                currentSessionSeconds={timerDisplaySeconds} // Using currentSessionSeconds to display the running active time. Actually, the task view used to display total time in the big slot.
                                isRunning={isTaskRunning}
                                isPaused={isTaskPaused}
                                timerStatusLabel={timerStatusLabel}
                                onPrimaryAction={handleTaskTimerPrimaryAction}
                                onStopAction={() => void globalStopTimer()}
                                isPrimaryDisabled={projectActionsBlocked || (!savedProjectId && !isActiveTimerThisTask)}
                                isStopDisabled={!isActiveTimerThisTask}
                            />

                            {isManualTimeOpen && (
                                <SidePanelManualTimeForm
                                    minutes={manualMinutes}
                                    notes={manualNotes}
                                    onMinutesChange={setManualMinutes}
                                    onNotesChange={setManualNotes}
                                    onSave={handleManualLog}
                                    isSaving={isLoggingTime}
                                    disabled={projectActionsBlocked}
                                    className="premium-card rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-sm"
                                />
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <SidePanelSectionTitle title="Time history" icon={<Clock className="h-3.5 w-3.5" />} />
                                <div className="text-xs font-semibold text-[var(--text-muted)]">
                                    {sortedTimeLogs.length} Sessions
                                </div>
                            </div>

                            <SidePanelTimeLogHistoryList
                                logs={sortedTimeLogs}
                                emptyMessage="No time logs recorded for this task yet."
                            />
                        </div>
                    </section> : (
                        <section className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <SidePanelSectionTitle title="Task time" icon={<Clock className="h-3.5 w-3.5" />} />
                                    <div className="flex items-center gap-2">
                                        <TaskActualTimeQuickEdit
                                            taskId={task.id}
                                            taskName={name}
                                            totalSeconds={loggedSeconds}
                                            onSaved={setDisplayTrackedSeconds}
                                            disabled={projectActionsBlocked}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsManualTimeOpen((current) => !current)}
                                            disabled={projectActionsBlocked}
                                            className="h-8 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 ui-text-caption text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                        >
                                            <Plus className="mr-1 h-3.5 w-3.5" />
                                            Add Time
                                        </Button>
                                    </div>
                                </div>

                                {isManualTimeOpen ? (
                                    <SidePanelManualTimeForm
                                        minutes={manualMinutes}
                                        notes={manualNotes}
                                        onMinutesChange={setManualMinutes}
                                        onNotesChange={setManualNotes}
                                        onSave={handleManualLog}
                                        isSaving={isLoggingTime}
                                        disabled={projectActionsBlocked}
                                        saveLabel="Add session"
                                        className="premium-card rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-sm"
                                    />
                                ) : null}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <SidePanelSectionTitle title="Time history" icon={<Clock className="h-3.5 w-3.5" />} />
                                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                                        {sortedTimeLogs.length} Sessions
                                    </div>
                                </div>
                                <SidePanelTimeLogHistoryList
                                    logs={sortedTimeLogs}
                                    emptyMessage="No time sessions recorded for this task yet."
                                />
                            </div>
                        </section>
                    )) : null}

                        {activeTab === "overview" ? <section className="space-y-3 border-t border-[var(--line-subtle)] pt-5">
                            <SidePanelSectionTitle title="Linked information" icon={<Info className="h-3.5 w-3.5" />} />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {taskScope === "LMS" ? (
                                    <>
                                        <SidePanelInfoCard
                                            title="LMS project"
                                            subtitle={<p className="truncate text-base font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-lg">{lmsAllocationId ? selectedLmsAllocationName : "Not linked"}</p>}
                                        />
                                        <SidePanelInfoCard
                                            title="Work category"
                                            subtitle={<p className="truncate text-base font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-lg">{lmsTaskTypeId ? selectedLmsTaskTypeName : "Not linked"}</p>}
                                        />
                                    </>
                                ) : taskScope === "GENERAL" ? (
                                    <SidePanelInfoCard
                                        title="Target"
                                        subtitle={<p className="text-base font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-lg">Target required</p>}
                                    />
                                ) : <>
                                <button
                                    type="button"
                                    onClick={openProjectDetails}
                                    disabled={projectActionsBlocked || !savedProjectId}
                                    className={cn(
                                        "text-left",
                                        !projectActionsBlocked && savedProjectId
                                            ? "hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                            : "cursor-not-allowed opacity-60"
                                    )}
                                >
                                    <SidePanelInfoCard
                                        title="Project"
                                        subtitle={(
                                            <p className="truncate text-base font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-lg">
                                                {projectLabel}
                                            </p>
                                        )}
                                        action={<FolderOpen className="h-4 w-4 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]" />}
                                    >
                                        <p className="truncate text-xs font-medium text-[var(--text-secondary)]">{projectPartnerLabel}</p>
                                    </SidePanelInfoCard>
                                </button>

                                <SidePanelInfoCard
                                    title="Domain"
                                    subtitle={(
                                        <button
                                            type="button"
                                            onClick={openSitePanel}
                                            disabled={projectActionsBlocked || !savedProjectMatchesTaskProp || (!projectSitePanelHref && !onOpenSite)}
                                            className={cn(
                                                "truncate text-left text-base font-black leading-tight tracking-tight transition sm:text-lg",
                                                !projectActionsBlocked && savedProjectMatchesTaskProp && (projectSitePanelHref || onOpenSite)
                                                    ? "text-[var(--text-primary)] hover:text-[var(--primary)]"
                                                    : "cursor-not-allowed text-[var(--text-muted)]"
                                            )}
                                            title="Open site panel"
                                        >
                                            {projectDomainLabel}
                                        </button>
                                    )}
                                    action={
                                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]">
                                            <Globe className="h-4 w-4" />
                                            <ArrowUpRight className="h-4 w-4" />
                                        </span>
                                    }
                                >
                                    <div className="flex items-center gap-2">
                                        {projectDomainUrl ? (
                                            <a href={projectDomainUrl} target="_blank" rel="noopener noreferrer">
                                                <SidePanelChip
                                                    tone="blue"
                                                    label={(
                                                        <>
                                                            Open website
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                        </>
                                                    )}
                                                    className="rounded-lg px-2.5 py-1.5 text-xs"
                                                />
                                            </a>
                                        ) : (
                                            <SidePanelChip tone="slate" label="Open website" className="cursor-not-allowed rounded-lg px-2.5 py-1.5 text-xs opacity-70" />
                                        )}
                                    </div>
                                </SidePanelInfoCard>
                                </>}
                            </div>
                        </section> : null}

                    {activeTab === "activity" ? (
                        <div className="space-y-6">
                            <TaskHistorySection entries={taskHistoryEntries} isLoading={isLoadingTaskHistory} />
                            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4">
                                <SidePanelDetailRow label="Task ID" value={task.id.split("-")[0]} />
                                <SidePanelDetailRow label="Created" value={formatBottomDate(createdTimestamp)} />
                                <SidePanelDetailRow label="Updated" value={lastUpdatedTimestamp ? formatBottomDate(lastUpdatedTimestamp) : "—"} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

                {activeTab === "overview" && isEditingDetails ? (
                    <div className="flex items-center justify-end gap-3 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-4 sm:px-8">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelDetailsEdit}
                            disabled={loading}
                            className="h-11 rounded-xl px-5"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleUpdate()}
                            disabled={loading || !detailsDirty || (taskScope === "FREELANCE" && !projectId)}
                            className="h-11 rounded-xl px-5"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save changes
                        </Button>
                    </div>
                ) : null}

                <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
                    <DialogContent
                        showCloseButton={false}
                        overlayClassName="bg-slate-900/18 backdrop-blur-[6px]"
                        className={sidePanelDialogContentClass("default")}
                    >
                        <DialogHeader className={SIDE_PANEL_DIALOG_HEADER_CLASS}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-lg font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                                        Task Notes - {name || "Untitled Task"}
                                    </DialogTitle>
                                </div>
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 text-sm font-semibold text-[var(--text-secondary)] shadow-sm hover:bg-[var(--surface-low)]"
                                    >
                                        <X className="mr-2 h-4 w-4" />
                                        Close
                                    </Button>
                                </DialogClose>
                            </div>
                        </DialogHeader>
                        <div className="flex h-[calc(92vh-81px)] flex-col overflow-hidden bg-[var(--surface-lowest)] px-8 pb-8 pt-6">
                            <RichTextEditor
                                value={description}
                                onChange={handleTaskDescriptionChange}
                                placeholder=""
                                variant="plain"
                                mode="document"
                                className="h-full"
                                minHeightClassName="min-h-0"
                                uploadProjectId={savedProjectId || task.id}
                                imageUploadsDisabled={projectActionsBlocked}
                                toolbarVisibility="always"
                                toolbarActions={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={appendTaskNotesTemplate}
                                        className="h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                        aria-label="Add template"
                                        title="Add template"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </SheetContent>
        </Sheet>
    )
}
