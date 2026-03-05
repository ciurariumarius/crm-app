"use client"

import * as React from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
    AlertCircle,
    Check,
    Clock3,
    Cloud,
    FolderOpen,
    Globe,
    Loader2,
    Pause,
    Play,
    Plus,
    Square,
    Trash2,
    X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { cn, formatProjectName } from "@/lib/utils"
import { updateProject, deleteProject } from "@/lib/actions/projects"
import { logTime } from "@/lib/actions/time"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTimer } from "@/components/providers/timer-provider"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { ProjectWithDetails } from "@/types"
import { Service, Site } from "@prisma/client"

type UpdateProjectPayload = {
    name?: string
    description?: string | null
    status?: "Active" | "Paused" | "Completed"
    paymentStatus?: "Paid" | "Unpaid"
    paidAt?: Date | string | null
    currentFee?: number | null
    serviceIds?: string[]
}

interface ProjectSheetContentProps {
    project: ProjectWithDetails
    allServices: Service[]
    onUpdate?: (updatedProject: ProjectWithDetails) => void
    onOpenSite?: (site: Site) => void
    standalone?: boolean
    onClose?: () => void
}

function toDate(value: Date | string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatClock(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":")
}

function formatDurationLabel(totalSeconds: number) {
    if (!totalSeconds) return "0s"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
}

function formatBottomDate(value: Date | null) {
    if (!value) return "—"
    return format(value, "d MMM. yy, HH:mm")
}

export function ProjectSheetContent({
    project: initialProject,
    allServices,
    onUpdate,
    onOpenSite: _onOpenSite,
    standalone = false,
    onClose,
}: ProjectSheetContentProps) {
    const [project, setProject] = React.useState<ProjectWithDetails>(initialProject)
    const [localName, setLocalName] = React.useState("")
    const [amountInput, setAmountInput] = React.useState("")
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const [isEditingServices, setIsEditingServices] = React.useState(false)
    const [description, setDescription] = React.useState("")
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false)
    const [manualMinutes, setManualMinutes] = React.useState("")
    const [manualNotes, setManualNotes] = React.useState("")
    const [isLoggingTime, setIsLoggingTime] = React.useState(false)
    const [selectedTimeLog, setSelectedTimeLog] = React.useState<any | null>(null)
    const [isTimeLogSheetOpen, setIsTimeLogSheetOpen] = React.useState(false)
    const router = useRouter()
    const {
        timerState,
        startTimer: globalStartTimer,
        stopTimer: globalStopTimer,
        pauseTimer: globalPauseTimer,
        resumeTimer: globalResumeTimer,
    } = useTimer()

    React.useEffect(() => {
        setProject(initialProject)
    }, [initialProject])

    React.useEffect(() => {
        setLocalName(project.name || formatProjectName(project))
        setDescription(project.description || "")
        setAmountInput(project.currentFee == null ? "" : String(Math.round(Number(project.currentFee))))
    }, [project.id])

    const handleUpdate = React.useCallback(
        async (data: UpdateProjectPayload) => {
            setUpdatingId(project.id)
            try {
                const result = await updateProject(project.id, data as any)
                if (!result.success) {
                    toast.error(result.error || "Update failed")
                    return
                }

                let updatedProject: ProjectWithDetails = project

                if (data.serviceIds) {
                    const nextServices = allServices.filter((service) => data.serviceIds?.includes(service.id))
                    updatedProject = { ...project, services: nextServices }
                } else {
                    const nextPaidAt =
                        data.paidAt !== undefined
                            ? data.paidAt
                                ? toDate(data.paidAt)
                                : null
                            : project.paidAt

                    updatedProject = {
                        ...project,
                        ...(data.name !== undefined ? { name: data.name } : {}),
                        ...(data.description !== undefined ? { description: data.description } : {}),
                        ...(data.status !== undefined ? { status: data.status } : {}),
                        ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus } : {}),
                        ...(data.paidAt !== undefined ? { paidAt: nextPaidAt } : {}),
                        ...(data.currentFee !== undefined ? { currentFee: data.currentFee } : {}),
                    } as ProjectWithDetails
                }

                setProject(updatedProject)
                onUpdate?.(updatedProject)
                router.refresh()
            } catch {
                toast.error("Update failed")
            } finally {
                setUpdatingId(null)
            }
        },
        [allServices, onUpdate, project, router]
    )

    const isInitialMount = React.useRef(true)
    React.useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        const timer = setTimeout(() => {
            if (description !== (project.description || "")) {
                void handleUpdate({ description })
            }
        }, 400)

        return () => clearTimeout(timer)
    }, [description, project.description, handleUpdate])

    const toggleService = (serviceId: string) => {
        const currentServices = project.services || []
        const currentIds = currentServices.map((service) => service.id)

        let nextIds: string[]

        if (currentIds.includes(serviceId)) {
            if (currentIds.length === 1) {
                toast.error("Project must keep at least one service")
                return
            }
            nextIds = currentIds.filter((id) => id !== serviceId)
        } else {
            const selectedService = allServices.find((service) => service.id === serviceId)
            if (!selectedService) return

            if (currentServices.length > 0) {
                const isCurrentRecurring = currentServices[0]?.isRecurring
                if (selectedService.isRecurring !== isCurrentRecurring) {
                    toast.error("Recurring and one-time services cannot be mixed", {
                        icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
                    })
                    return
                }
            }

            nextIds = [...currentIds, serviceId]
        }

        void handleUpdate({ serviceIds: nextIds })
    }

    const commitTitle = () => {
        const next = localName.trim()
        const current = project.name || formatProjectName(project)

        if (!next) {
            setLocalName(current)
            setIsEditingTitle(false)
            return
        }

        if (next !== current) {
            void handleUpdate({ name: next })
        }

        setIsEditingTitle(false)
    }

    const handleAmountBlur = () => {
        const rawValue = amountInput.trim()
        if (!rawValue) {
            if (project.currentFee !== null) {
                void handleUpdate({ currentFee: null })
            }
            return
        }

        const parsed = Number.parseInt(rawValue, 10)
        if (Number.isNaN(parsed)) {
            setAmountInput(project.currentFee == null ? "" : String(Math.round(Number(project.currentFee))))
            return
        }

        if (parsed !== Number(project.currentFee ?? 0)) {
            void handleUpdate({ currentFee: parsed })
        }

        setAmountInput(String(parsed))
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this project permanently?")) {
            return
        }

        setIsDeleting(true)
        try {
            const result = await deleteProject(project.id)
            if (!result.success) {
                toast.error(result.error || "Failed to delete project")
                return
            }

            toast.success("Project deleted")
            onClose?.()

            if (standalone) {
                router.push("/projects")
            }

            router.refresh()
        } catch {
            toast.error("Failed to delete project")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleManualLog = async () => {
        const minutes = Number(manualMinutes)
        if (!manualMinutes || Number.isNaN(minutes) || minutes <= 0) {
            toast.error("Please enter a valid number of minutes")
            return
        }

        setIsLoggingTime(true)
        try {
            const now = new Date()
            const response = await logTime({
                projectId: project.id,
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

    const isTimerForProject = timerState.projectId === project.id && !timerState.taskId
    const logsSeconds = (project.timeLogs || []).reduce((sum, log) => sum + (log.durationSeconds || 0), 0)
    const runningSeconds = isTimerForProject ? timerState.elapsedSeconds : 0
    const totalTrackedSeconds = logsSeconds + runningSeconds
    const timerPrimaryLabel =
        isTimerForProject && timerState.isRunning
            ? "Pause"
            : isTimerForProject
                ? "Resume"
                : "Start"

    const handleTimerPrimaryAction = () => {
        if (isTimerForProject) {
            if (timerState.isRunning) {
                void globalPauseTimer()
            } else {
                void globalResumeTimer()
            }
            return
        }

        void globalStartTimer(project.id, undefined, project.name || formatProjectName(project))
    }

    const recentLogs = [...(project.timeLogs || [])].sort((a, b) => {
        const left = toDate(a.startTime)?.getTime() || 0
        const right = toDate(b.startTime)?.getTime() || 0
        return right - left
    })

    const recurringServices = allServices.filter((service) => service.isRecurring)
    const oneTimeServices = allServices.filter((service) => !service.isRecurring)
    const createdAt = toDate(project.createdAt)
    const updatedAt = toDate(project.updatedAt)
    const createdTimestamp = createdAt || updatedAt || new Date()
    const lastUpdatedTimestamp =
        createdAt && updatedAt && updatedAt.getTime() > createdAt.getTime()
            ? updatedAt
            : null
    const timeLogProjects = React.useMemo(
        () => [{ id: project.id, displayName: localName || formatProjectName(project) }],
        [project.id, localName, project]
    )
    const timeLogTasks = React.useMemo(
        () =>
            (project.tasks || []).map((task: any) => ({
                id: task.id,
                name: task.name,
                projectId: task.projectId || project.id,
            })),
        [project.tasks, project.id]
    )

    return (
        <TaskSheetWrapper tasks={project.tasks || []} project={project}>
            <div className="relative flex h-full flex-col overflow-hidden bg-[#f7f9fc]">
                {!standalone && onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-8 top-8 z-20 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
                        aria-label="Close project"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="flex-1 overflow-y-auto px-8 pb-6 pt-10">
                    <div className="space-y-8 pb-20">
                        <div className="space-y-3 pr-14">
                            {isEditingTitle ? (
                                <Textarea
                                    value={localName}
                                    onChange={(event) => setLocalName(event.target.value)}
                                    className="min-h-[52px] resize-none border-none bg-transparent p-0 text-3xl font-black leading-tight tracking-tight text-slate-900 focus-visible:ring-0 sm:text-4xl"
                                    rows={1}
                                    autoFocus
                                    onBlur={commitTitle}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault()
                                            commitTitle()
                                        }
                                        if (event.key === "Escape") {
                                            setLocalName(project.name || formatProjectName(project))
                                            setIsEditingTitle(false)
                                        }
                                    }}
                                    onInput={(event) => {
                                        const target = event.target as HTMLTextAreaElement
                                        target.style.height = "auto"
                                        target.style.height = `${target.scrollHeight}px`
                                    }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsEditingTitle(true)}
                                    className="text-left"
                                >
                                    <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
                                        {localName || formatProjectName(project)}
                                        <span className="pl-3 text-blue-500">/ {format(toDate(project.createdAt) || new Date(), "MMMM yyyy")}</span>
                                    </h1>
                                </button>
                            )}

                            <p className="text-sm font-medium text-slate-400">
                                Created {formatDistanceToNow(toDate(project.createdAt) || new Date(), { addSuffix: true })}
                                {updatingId === project.id && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Project Status</p>
                                <Select
                                    value={project.status}
                                    onValueChange={(value) => void handleUpdate({ status: value as UpdateProjectPayload["status"] })}
                                >
                                    <SelectTrigger className="mt-1 h-auto border-none bg-transparent p-0 text-left text-xl font-black tracking-tight text-emerald-700 shadow-none focus:ring-0 sm:text-2xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Paused">Paused</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">Payment Status</p>
                                <Select
                                    value={project.paymentStatus}
                                    onValueChange={(value) => {
                                        const updates: UpdateProjectPayload = {
                                            paymentStatus: value as UpdateProjectPayload["paymentStatus"],
                                        }

                                        if (value === "Paid" && !project.paidAt) {
                                            updates.paidAt = new Date()
                                        }

                                        if (value === "Unpaid") {
                                            updates.paidAt = null
                                        }

                                        void handleUpdate(updates)
                                    }}
                                >
                                    <SelectTrigger className="mt-1 h-auto border-none bg-transparent p-0 text-left text-xl font-black tracking-tight text-rose-700 shadow-none focus:ring-0 sm:text-2xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                            <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Amount</p>
                                <div className="mt-2 flex items-end gap-2">
                                    <Input
                                        type="number"
                                        step={1}
                                        value={amountInput}
                                        onChange={(event) => setAmountInput(event.target.value)}
                                        onBlur={handleAmountBlur}
                                        className="h-auto border-none bg-transparent p-0 text-3xl font-black tracking-tight text-slate-900 shadow-none focus-visible:ring-0 sm:text-4xl"
                                        placeholder="0"
                                    />
                                    <span className="pb-2 text-lg font-bold text-slate-400">RON</span>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Active Services</p>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingServices((current) => !current)}
                                        className="rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 hover:border-slate-400"
                                    >
                                        + Add
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {project.services?.map((service) => (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => toggleService(service.id)}
                                            className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-blue-600"
                                        >
                                            {service.serviceName}
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {isEditingServices && (
                            <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-500">Recurring</p>
                                        <div className="mt-2 space-y-2">
                                            {recurringServices.map((service) => {
                                                const isSelected = project.services?.some((item) => item.id === service.id)
                                                return (
                                                    <button
                                                        key={service.id}
                                                        type="button"
                                                        onClick={() => toggleService(service.id)}
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                                                            isSelected
                                                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                                                        )}
                                                    >
                                                        {service.serviceName}
                                                        {isSelected && <Check className="h-4 w-4" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-500">One-Time</p>
                                        <div className="mt-2 space-y-2">
                                            {oneTimeServices.map((service) => {
                                                const isSelected = project.services?.some((item) => item.id === service.id)
                                                return (
                                                    <button
                                                        key={service.id}
                                                        type="button"
                                                        onClick={() => toggleService(service.id)}
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                                                            isSelected
                                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                                                        )}
                                                    >
                                                        {service.serviceName}
                                                        {isSelected && <Check className="h-4 w-4" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <section className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Project Tasks</h2>
                            <ProjectTasks projectId={project.id} initialTasks={project.tasks || []} />
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Notes & Documentation</h2>

                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Add scope details, technical notes, or client requests..."
                            />
                        </section>

                        <section className="space-y-4">
                            <div className="rounded-2xl bg-[radial-gradient(circle_at_top_right,_#1f4ed8_0%,_#0c1533_30%,_#091127_100%)] px-5 py-4 text-white shadow-lg">
                                <div className="flex flex-wrap items-center justify-between gap-5">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">Project Timer</p>
                                        <div className="mt-1 flex flex-wrap items-end gap-3">
                                            <span className="text-3xl font-black leading-none tabular-nums sm:text-4xl">{formatClock(totalTrackedSeconds)}</span>
                                            <span className={cn(
                                                "pb-1 text-[13px] font-black uppercase",
                                                isTimerForProject && timerState.isRunning ? "text-emerald-300" : "text-slate-300"
                                            )}>
                                                {isTimerForProject && timerState.isRunning ? "Working" : isTimerForProject ? "Paused" : "Ready"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                        <Button
                                            type="button"
                                            onClick={handleTimerPrimaryAction}
                                            className="h-10 rounded-full bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-all active:scale-[0.98]"
                                        >
                                            {isTimerForProject && timerState.isRunning ? (
                                                <Pause className="mr-2 h-3.5 w-3.5 fill-current" />
                                            ) : (
                                                <Play className="mr-2 h-3.5 w-3.5 fill-current" />
                                            )}
                                            {timerPrimaryLabel}
                                        </Button>

                                        <Button
                                            type="button"
                                            size="icon"
                                            disabled={!isTimerForProject}
                                            onClick={() => void globalStopTimer()}
                                            className="h-10 w-10 rounded-full bg-blue-500 text-white shadow-[0_0_28px_rgba(59,130,246,0.55)] hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/40 transition-all active:scale-[0.98]"
                                        >
                                            <Square className="h-3.5 w-3.5 fill-current" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Recent Time Logs
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsManualTimeOpen((current) => !current)}
                                    className="h-8 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-black uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-200"
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add Time
                                </Button>
                            </div>

                            {isManualTimeOpen && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto]">
                                        <Input
                                            type="number"
                                            value={manualMinutes}
                                            onChange={(event) => setManualMinutes(event.target.value)}
                                            placeholder="Minutes"
                                            className="h-10 rounded-xl border-slate-200"
                                        />
                                        <Input
                                            value={manualNotes}
                                            onChange={(event) => setManualNotes(event.target.value)}
                                            placeholder="Optional note"
                                            className="h-10 rounded-xl border-slate-200"
                                        />
                                        <Button
                                            onClick={handleManualLog}
                                            disabled={isLoggingTime || !manualMinutes}
                                            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
                                        >
                                            {isLoggingTime ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {recentLogs.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-500">
                                        No time logged for this project yet.
                                    </div>
                                )}

                                {recentLogs.map((log) => {
                                    const start = toDate(log.startTime)
                                    const end = toDate(log.endTime)
                                    return (
                                        <button
                                            type="button"
                                            key={log.id}
                                            onClick={() => {
                                                setSelectedTimeLog(log)
                                                setIsTimeLogSheetOpen(true)
                                            }}
                                            className="w-full text-left rounded-3xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-lg font-bold text-slate-700">
                                                        {start ? format(start, "MMM do, yyyy") : "Unknown date"}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                                        <span>
                                                            {start ? format(start, "HH:mm") : "--:--"} - {end ? format(end, "HH:mm") : "Ongoing"}
                                                        </span>
                                                        {(log as any).task?.name && (
                                                            <Badge className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">
                                                                {(log as any).task.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <span className="text-lg font-black text-slate-600">
                                                    {formatDurationLabel(log.durationSeconds || 0)}
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Context & Assets</h2>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Link
                                    href={`/vault/${project.site.partner.id}`}
                                    className="group rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-[var(--shadow-card)] transition hover:border-slate-300"
                                >
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Partner</p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <p className="truncate text-base font-black leading-tight tracking-tight text-slate-800 sm:text-lg">
                                            {project.site.partner.name}
                                        </p>
                                        <FolderOpen className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
                                    </div>
                                </Link>

                                <Link
                                    href={`/vault/${project.site.partner.id}/${project.site.id}`}
                                    className="group rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-[var(--shadow-card)] transition hover:border-slate-300"
                                >
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Domain</p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <p className="truncate text-base font-black leading-tight tracking-tight text-slate-800 sm:text-lg">
                                            {project.site.domainName}
                                        </p>
                                        <Globe className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
                                    </div>
                                </Link>
                            </div>
                        </section>

                        <section>
                            <Button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="h-11 rounded-xl bg-rose-50 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                            >
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Delete Project
                            </Button>
                        </section>
                    </div>
                </div>

                <div className="sticky bottom-0 flex flex-col gap-1 border-t border-slate-200 bg-white/95 px-6 py-3 text-[11px] font-semibold text-slate-500 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <span># Project ID: {project.id.split("-")[0]}</span>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span>Created: {formatBottomDate(createdTimestamp)}</span>
                        <span className="inline-flex items-center gap-1.5">
                            Last updated: {formatBottomDate(lastUpdatedTimestamp)}
                            <Cloud className="h-3.5 w-3.5" />
                        </span>
                    </div>
                </div>

                <TimeLogSheet
                    log={selectedTimeLog}
                    open={isTimeLogSheetOpen}
                    onOpenChange={(open) => {
                        setIsTimeLogSheetOpen(open)
                        if (!open) {
                            setSelectedTimeLog(null)
                            router.refresh()
                        }
                    }}
                    projects={timeLogProjects}
                    tasks={timeLogTasks}
                />
            </div>
        </TaskSheetWrapper>
    )
}
