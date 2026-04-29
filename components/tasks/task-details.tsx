"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
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
import { Calendar as CalendarIcon, Clock, Check, Loader2, X, Play, Pencil, Plus, ArrowUpRight, FolderOpen, Globe, FileText, Info } from "lucide-react"
import { updateTask, deleteTask, getTaskHistory } from "@/lib/actions/tasks"
import { logTime } from "@/lib/actions/time"
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
import { SIDE_PANEL_DIALOG_HEADER_CLASS, SIDE_PANEL_HEADER_CLASS, sidePanelClass, sidePanelDialogContentClass, type SidePanelSize } from "@/lib/ui/side-panels"
import { SidePanelChip, SidePanelInfoCard, SidePanelMetaBar, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"
import { TaskHistorySection, type TaskHistoryEntry } from "@/components/tasks/task-history-section"

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
    panelSize = "default",
    panelStackLevel = 0,
}: TaskDetailsProps) {
    const { timerState, startTimer: globalStartTimer, stopTimer: globalStopTimer, pauseTimer: globalPauseTimer, resumeTimer: globalResumeTimer } = useTimer()
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)

    // Form state
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [status, setStatus] = React.useState("")
    const [urgency, setUrgency] = React.useState("")
    const [deadline, setDeadline] = React.useState<Date | undefined>(undefined)
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false)
    const [manualMinutes, setManualMinutes] = React.useState("")
    const [manualNotes, setManualNotes] = React.useState("")
    const [isLoggingTime, setIsLoggingTime] = React.useState(false)
    const [isNotesModalOpen, setIsNotesModalOpen] = React.useState(false)
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const [taskHistory, setTaskHistory] = React.useState<TaskHistoryEntry[]>([])
    const [isLoadingTaskHistory, setIsLoadingTaskHistory] = React.useState(false)

    // Sync form state with task
    const skipNextAutoSave = React.useRef(true)
    React.useEffect(() => {
        if (task) {
            setName(task.name || "")
            setDescription(task.description || "")
            setStatus(normalizeTaskStatus(task.status))
            setUrgency(normalizeTaskUrgency(task.urgency))
            setDeadline(task.deadline ? new Date(task.deadline) : undefined)
            setIsManualTimeOpen(false)
            setManualMinutes("")
            setManualNotes("")
            setIsEditingTitle(false)
            skipNextAutoSave.current = true
        }
    }, [task])

    const fetchTaskHistory = React.useCallback(async () => {
        if (!task?.id) return
        setIsLoadingTaskHistory(true)
        try {
            const result = await getTaskHistory(task.id)
            if (result.success) {
                setTaskHistory(result.data || [])
            }
        } catch (error) {
            console.error("Failed to load task history", error)
        } finally {
            setIsLoadingTaskHistory(false)
        }
    }, [task?.id])

    React.useEffect(() => {
        if (!task?.id) return
        void fetchTaskHistory()
    }, [task?.id, fetchTaskHistory])

    const handleUpdate = React.useCallback(async () => {
        if (!task) return
        setLoading(true)
        try {
            const result = await updateTask(task.id, {
                name,
                description,
                status,
                urgency,
                deadline,
            })

            if (result.success) {
                toast.success("Task updated")
                void fetchTaskHistory()
            } else {
                toast.error(result.error || "Failed to update task")
            }
        } catch {
            toast.error("Failed to update task")
        } finally {
            setLoading(false)
        }
    }, [deadline, description, fetchTaskHistory, name, status, task, urgency])

    // Auto-save logic
    React.useEffect(() => {
        if (!task) return

        if (skipNextAutoSave.current) {
            skipNextAutoSave.current = false
            return
        }

        const normalizedTaskName = task.name || ""
        const normalizedTaskDescription = task.description || ""
        const normalizedTaskStatus = normalizeTaskStatus(task.status)
        const normalizedTaskUrgency = normalizeTaskUrgency(task.urgency)
        const normalizedTaskDeadline = task.deadline ? new Date(task.deadline).getTime() : undefined

        const timer = setTimeout(() => {
            if (
                name !== normalizedTaskName ||
                description !== normalizedTaskDescription ||
                status !== normalizedTaskStatus ||
                urgency !== normalizedTaskUrgency ||
                deadline?.getTime() !== normalizedTaskDeadline
            ) {
                handleUpdate()
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [deadline, description, handleUpdate, name, status, task, urgency])

    const handleDelete = async () => {
        if (!task) return
        try {
            const result = await deleteTask(task.id, task.projectId)
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

    const notesSaveState = React.useMemo(() => {
        const isDirty = description !== (task?.description || "")
        if (loading && isDirty) return "saving"
        if (isDirty) return "typing"
        return "ready"
    }, [description, loading, task?.description])

    const appendTaskNotesTemplate = React.useCallback(() => {
        setDescription((current) => {
            if (!current.trim()) return TASK_NOTES_TEMPLATE
            return `${current}<p></p>${TASK_NOTES_TEMPLATE}`
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
    const isActiveTimerThisTask = timerState.taskId === task.id
    const isTaskRunning = isActiveTimerThisTask && timerState.isRunning
    const isTaskPaused = isActiveTimerThisTask && !timerState.isRunning
    const loggedSeconds = task.timeLogs?.reduce((acc: number, log: TaskTimeLog) => acc + (log.durationSeconds || 0), 0) || 0
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
    const projectLabel = task.project ? formatProjectName(task.project) : "Project"
    const projectPartnerLabel = task.project?.site?.partner?.name || "Partner"
    const projectDomainLabel = task.project?.site?.domainName || "Domain"
    const projectDomainUrl = normalizeExternalHttpUrl(task.project?.site?.domainName)
    const projectSitePanelHref =
        task.project?.site?.partner?.id && task.project?.site?.id
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

        if (!task.projectId) {
            toast.error("Task has no project")
            return
        }

        void globalStartTimer(task.projectId, task.id, task.name || "Task")
    }

    const openProjectDetails = () => {
        if (!task.projectId) return
        if (onOpenProject) {
            onOpenProject({
                ...(task.project || {}),
                id: task.projectId,
                tasks: task.project?.tasks || [],
                timeLogs: task.project?.timeLogs || [],
            })
            return
        }

        router.push(`/projects?openProject=${encodeURIComponent(task.projectId)}`)
    }

    const openSitePanel = () => {
        if (task.project?.site && onOpenSite) {
            onOpenSite(task.project.site)
            return
        }
        if (projectSitePanelHref) {
            router.push(projectSitePanelHref)
        }
    }

    const commitTitle = () => {
        if (!task) return
        if ((name || "").trim() !== (task.name || "").trim()) {
            void handleUpdate()
        }
        setIsEditingTitle(false)
    }

    const handleManualLog = async () => {
        if (!task.projectId) {
            toast.error("Task has no project")
            return
        }

        const minutes = Number.parseInt(manualMinutes, 10)
        if (!manualMinutes || Number.isNaN(minutes) || minutes <= 0) {
            toast.error("Please enter a valid number of minutes")
            return
        }

        setIsLoggingTime(true)
        try {
            const now = new Date()
            const response = await logTime({
                projectId: task.projectId,
                taskId: task.id,
                durationSeconds: minutes * 60,
                description: manualNotes || undefined,
                startTime: new Date(now.getTime() - minutes * 60 * 1000),
                endTime: now,
            })

            if (!response.success) {
                toast.error(response.error || "Failed to log time")
                return
            }

            toast.success("Time logged")
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
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={cn(sidePanelClass(panelSize, panelStackLevel), "overflow-y-auto md:overflow-hidden")}
                onOpenAutoFocus={(e) => e.preventDefault()}
                showCloseButton={false}
            >
                <SheetHeader className={SIDE_PANEL_HEADER_CLASS}>
                    <div className="absolute right-6 top-6 z-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="space-y-5 pr-16">
                        <SheetTitle className="group relative">
                            <div className="space-y-6">
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
                                                    setName(task.name || "")
                                                    setIsEditingTitle(false)
                                                }
                                            }}
                                            onBlur={commitTitle}
                                            className="min-h-[44px] resize-none !rounded-none !border-0 !border-b !border-[var(--line-subtle)] !bg-transparent !px-0 !pb-1 !pt-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] !shadow-none focus-visible:!border-b-2 focus-visible:!border-blue-300 focus-visible:!ring-0 md:text-2xl"
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
                                                aria-label="Edit task title"
                                                title="Edit task title"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {loading && <Loader2 className="absolute right-0 top-0 h-5 w-5 animate-spin text-primary" />}
                                </div>
                                {name !== task.name && (
                                    <div className="text-xs font-semibold text-primary animate-pulse">
                                        Unsaved Name Change
                                    </div>
                                )}
                            </div>
                        </SheetTitle>
                    </div>
                </SheetHeader>

                <div className="px-8 pb-6 pt-0 md:flex-1 md:overflow-y-auto">
                    <div className="space-y-8 pb-8">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:gap-3">
                            <div className="flex items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/status relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-3 transition-all duration-300 active:scale-[0.98] sm:h-11 sm:px-4",
                                                status === "Active"
                                                    ? "border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/50 text-blue-600 shadow-[0_2px_10px_-4px_rgba(37,99,235,0.15)] hover:border-blue-300/60"
                                                    : "border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 text-emerald-600 shadow-[0_2px_10px_-4px_rgba(16,185,129,0.15)] hover:border-emerald-300/60"
                                            )}
                                        >
                                            <div className="absolute inset-0 translate-y-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_22%,transparent)] transition-transform duration-300 group-hover/status:translate-y-0" />
                                            {status === "Active" ? <Play className="relative z-10 h-3.5 w-3.5 fill-current" /> : <Check className="relative z-10 h-3.5 w-3.5" />}
                                            <span className="relative z-10 text-xs font-bold tracking-[0.01em] sm:text-[13px]">{status}</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                        {(["Active", "Completed"] as const).map((statusOption) => (
                                            <DropdownMenuItem
                                                key={statusOption}
                                                onSelect={() => setStatus(statusOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                            >
                                                <span className={cn("mr-2 h-2 w-2 rounded-full", statusOption === "Active" ? "bg-blue-500" : "bg-emerald-500")} />
                                                {statusOption}
                                                {status === statusOption && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/priority relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-3 transition-all duration-300 active:scale-[0.98] sm:h-11 sm:px-4",
                                                urgency === "Urgent" && "border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-rose-100/50 text-rose-600 shadow-[0_2px_10px_-4px_rgba(225,29,72,0.15)] hover:border-rose-300/60",
                                                urgency === "Normal" && "border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-amber-100/50 text-amber-600 shadow-[0_2px_10px_-4px_rgba(217,119,6,0.15)] hover:border-amber-300/60",
                                                urgency === "Idea" && "border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/50 text-blue-600 shadow-[0_2px_10px_-4px_rgba(37,99,235,0.15)] hover:border-blue-300/60"
                                            )}
                                        >
                                            <div className="absolute inset-0 translate-y-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_22%,transparent)] transition-transform duration-300 group-hover/priority:translate-y-0" />
                                            <span className={cn(
                                                "relative z-10 h-2.5 w-2.5 rounded-full shadow-sm",
                                                urgency === "Urgent" && "bg-rose-500",
                                                urgency === "Normal" && "bg-amber-500",
                                                urgency === "Idea" && "bg-blue-500"
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
                                                    urgencyOption === "Urgent" && "bg-rose-500",
                                                    urgencyOption === "Normal" && "bg-amber-500",
                                                    urgencyOption === "Idea" && "bg-blue-500"
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
                                                "group/deadline relative flex h-10 w-full items-center justify-between overflow-hidden rounded-full border px-3 shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-300 active:scale-[0.98] sm:h-11 sm:px-4",
                                                deadline
                                                    ? "border-blue-200/70 bg-blue-50/40 text-blue-700 hover:border-blue-300/70"
                                                    : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                            )}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate text-xs font-bold tracking-[0.01em] sm:text-[13px]">
                                                    {deadline ? format(deadline, "dd MMM yyyy") : "Set deadline"}
                                                </span>
                                            </span>
                                            <span className="ml-2 inline-flex shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_80%,transparent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
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

                        <SidePanelNotesSection
                            title="Task notes"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            statusLabel={notesSaveState === "typing" ? "Typing" : notesSaveState === "saving" ? "Saving" : "Ready"}
                            statusTone={notesSaveState === "saving" ? "blue" : notesSaveState === "typing" ? "amber" : "emerald"}
                            statusState={notesSaveState}
                            value={description}
                            onChange={setDescription}
                            uploadProjectId={task?.projectId || task?.id}
                            onAddTemplate={appendTaskNotesTemplate}
                            onExpand={() => setIsNotesModalOpen(true)}
                            expandLabel="Open notes in full view"
                        />

                    <section className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <SidePanelSectionTitle title="Task time tracker" icon={<Clock className="h-3.5 w-3.5" />} />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsManualTimeOpen((current) => !current)}
                                    className="h-8 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 ui-text-caption text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add Time
                                </Button>
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
                                    className="premium-card rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-sm"
                                />
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <SidePanelSectionTitle title="Time history" icon={<Clock className="h-3.5 w-3.5" />} />
                                <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                                    {sortedTimeLogs.length} Sessions
                                </div>
                            </div>

                            <SidePanelTimeLogHistoryList
                                logs={sortedTimeLogs}
                                emptyMessage="No time logs recorded for this task yet."
                            />
                        </div>
                    </section>

                        <section className="space-y-3 border-t border-[var(--line-subtle)] pt-3">
                            <SidePanelSectionTitle title="Task info" icon={<Info className="h-3.5 w-3.5" />} />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={openProjectDetails}
                                    disabled={!task.projectId}
                                    className={cn(
                                        "text-left",
                                        task.projectId
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
                                        <p className="truncate text-[11px] font-medium text-[var(--text-secondary)]">{projectPartnerLabel}</p>
                                    </SidePanelInfoCard>
                                </button>

                                <SidePanelInfoCard
                                    title="Domain"
                                    subtitle={(
                                        <button
                                            type="button"
                                            onClick={openSitePanel}
                                            disabled={!projectSitePanelHref && !onOpenSite}
                                            className={cn(
                                                "truncate text-left text-base font-black leading-tight tracking-tight transition sm:text-lg",
                                                projectSitePanelHref || onOpenSite
                                                    ? "text-[var(--text-primary)] hover:text-blue-600"
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
                                                    className="rounded-lg px-2.5 py-1.5 text-[10px]"
                                                />
                                            </a>
                                        ) : (
                                            <SidePanelChip tone="slate" label="Open website" className="cursor-not-allowed rounded-lg px-2.5 py-1.5 text-[10px] opacity-70" />
                                        )}
                                    </div>
                                </SidePanelInfoCard>
                            </div>
                        </section>

                    <TaskHistorySection entries={taskHistoryEntries} isLoading={isLoadingTaskHistory} />


                        <SidePanelMetaBar
                            entityLabel="Task ID"
                            entityId={task.id.split("-")[0]}
                            onDelete={handleDelete}
                            createdAt={formatBottomDate(createdTimestamp)}
                            updatedAt={lastUpdatedTimestamp ? formatBottomDate(lastUpdatedTimestamp) : undefined}
                        />
                </div>
            </div>

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
                                onChange={setDescription}
                                placeholder=""
                                variant="plain"
                                mode="document"
                                className="h-full"
                                minHeightClassName="min-h-0"
                                uploadProjectId={task?.projectId || task?.id}
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
