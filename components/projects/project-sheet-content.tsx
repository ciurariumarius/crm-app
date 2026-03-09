"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
    AlertCircle,
    Check,
    CheckCircle,
    Clock3,
    Cloud,
    FolderOpen,
    Globe,
    History,
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
import { Textarea } from "@/components/ui/textarea"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { cn, formatProjectName, formatRelativeDate } from "@/lib/utils"
import { updateProject, deleteProject } from "@/lib/actions/projects"
import { logTime } from "@/lib/actions/time"
import { getProjectPaymentHistory } from "@/lib/actions/payment-actions"
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
    return formatRelativeDate(value)
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

    // Payment History State
    const [paymentHistory, setPaymentHistory] = React.useState<any[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)

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
    }, [project.description, project.name])

    const fetchPaymentHistory = React.useCallback(async () => {
        setIsLoadingHistory(true)
        try {
            const result = await getProjectPaymentHistory(project.id)
            if (result.success) {
                setPaymentHistory(result.data || [])
            }
        } catch (error) {
            console.error("Failed to load payment history", error)
        } finally {
            setIsLoadingHistory(false)
        }
    }, [project.id])

    React.useEffect(() => {
        fetchPaymentHistory()
    }, [fetchPaymentHistory])

    React.useEffect(() => {
        setAmountInput(project.currentFee == null ? "" : String(Math.round(Number(project.currentFee))))
    }, [project.currentFee, project.id])

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

                // Refresh history if payment status changed
                if (data.paymentStatus !== undefined) {
                    fetchPaymentHistory()
                }

                router.refresh()
            } catch {
                toast.error("Update failed")
            } finally {
                setUpdatingId(null)
            }
        },
        [allServices, onUpdate, project, router, fetchPaymentHistory]
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

    const updateProjectStatus = (value: UpdateProjectPayload["status"]) => {
        if (!value || value === project.status) return
        void handleUpdate({ status: value })
    }

    const updateProjectPaymentStatus = (value: UpdateProjectPayload["paymentStatus"]) => {
        if (!value || value === project.paymentStatus) return
        void handleUpdate({
            paymentStatus: value,
            paidAt: value === "Paid" ? new Date() : null,
        })
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
    const isProjectTimerRunning = isTimerForProject && timerState.isRunning
    const isProjectTimerPaused = isTimerForProject && !timerState.isRunning
    const timerStatusLabel = isProjectTimerRunning ? "Running" : isProjectTimerPaused ? "Paused" : "Ready"
    const loggedHours = Math.floor(logsSeconds / 3600)
    const loggedMinutes = Math.floor((logsSeconds % 3600) / 60)
    const timerPrimaryLabel =
        isProjectTimerRunning
            ? "Pause"
            : isProjectTimerPaused
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
        [project.id, localName]
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
            <div className="relative flex h-full flex-col overflow-hidden bg-[#f8fafc]">
                <div className="absolute right-8 top-8 z-20 flex items-center gap-2">
                    {!standalone && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
                            aria-label="Close project"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-6 pt-10">
                    <div className="space-y-8 pb-20">
                        <div className="space-y-3 pr-60">
                            {isEditingTitle ? (
                                <Textarea
                                    value={localName}
                                    onChange={(event) => setLocalName(event.target.value)}
                                    className="min-h-[44px] resize-none border-none bg-transparent p-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900 focus-visible:ring-0"
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
                                    <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-900">
                                        {localName || formatProjectName(project)}
                                        <span className="pl-3 text-blue-600">/ {format(toDate(project.createdAt) || new Date(), "MMMM yyyy")}</span>
                                    </h1>
                                </button>
                            )}

                            {updatingId === project.id && (
                                <div className="text-xs font-medium text-slate-400">
                                    <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                                    Updating...
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className={cn(
                                "rounded-2xl border p-3",
                                project.status === "Active"
                                    ? "border-[#BFDBFE] bg-[#EFF6FF]"
                                    : project.status === "Paused"
                                        ? "border-[#FDE68A] bg-[#FFFBEB]"
                                        : "border-[#A7F3D0] bg-[#ECFDF5]"
                            )}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">Project Status</p>

                                <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-white/80 bg-white/65 p-1 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)]">
                                    {(["Active", "Paused", "Completed"] as const).map((statusOption) => (
                                        <Button
                                            key={statusOption}
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => updateProjectStatus(statusOption)}
                                            className={cn(
                                                "h-7 rounded-full px-2 text-[11px] font-semibold transition-all border border-transparent",
                                                project.status === statusOption && statusOption === "Active" && "bg-gradient-to-b from-[#EFF6FF] to-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE] shadow-[0_1px_2px_rgba(37,99,235,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]",
                                                project.status === statusOption && statusOption === "Paused" && "bg-gradient-to-b from-[#FFFBEB] to-[#FEF3C7] text-[#B45309] border-[#FDE68A] shadow-[0_1px_2px_rgba(217,119,6,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]",
                                                project.status === statusOption && statusOption === "Completed" && "bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5] text-[#047857] border-[#A7F3D0] shadow-[0_1px_2px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]",
                                                project.status !== statusOption && "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                                            )}
                                        >
                                            {statusOption}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className={cn(
                                "rounded-2xl border p-3",
                                project.paymentStatus === "Paid" ? "border-[#A7F3D0] bg-[#ECFDF5]" : "border-[#FECDD3] bg-[#FFF1F2]"
                            )}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">Payment Status</p>

                                <div className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-white/80 bg-white/65 p-1 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)]">
                                    {(["Paid", "Unpaid"] as const).map((paymentOption) => (
                                        <Button
                                            key={paymentOption}
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => updateProjectPaymentStatus(paymentOption)}
                                            className={cn(
                                                "h-7 rounded-full px-2 text-[11px] font-semibold transition-all border border-transparent",
                                                project.paymentStatus === paymentOption && paymentOption === "Paid" && "bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5] text-[#047857] border-[#A7F3D0] shadow-[0_1px_2px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]",
                                                project.paymentStatus === paymentOption && paymentOption === "Unpaid" && "bg-gradient-to-b from-[#FFF1F2] to-[#FFE4E8] text-[#BE123C] border-[#FECDD3] shadow-[0_1px_2px_rgba(225,29,72,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]",
                                                project.paymentStatus !== paymentOption && "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                                            )}
                                        >
                                            {paymentOption}
                                        </Button>
                                    ))}
                                </div>
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

                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">Project Time Tracker</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="font-mono text-2xl font-bold leading-none text-slate-900 tabular-nums">
                                                {formatClock(totalTrackedSeconds)}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-[0.04em]",
                                                isProjectTimerRunning ? "text-[#10B981]" : isProjectTimerPaused ? "text-[#D97706]" : "text-slate-400"
                                            )}>
                                                {timerStatusLabel}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[11px] font-medium text-slate-500">
                                            {loggedHours}h {loggedMinutes}m logged
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            onClick={handleTimerPrimaryAction}
                                            className={cn(
                                                "h-8 rounded-lg px-3 text-xs font-semibold transition-all active:scale-[0.98]",
                                                isProjectTimerRunning
                                                    ? "bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7]"
                                                    : "bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"
                                            )}
                                        >
                                            {isProjectTimerRunning ? (
                                                <Pause className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                            ) : (
                                                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                            )}
                                            {timerPrimaryLabel}
                                        </Button>

                                        <Button
                                            type="button"
                                            size="icon"
                                            disabled={!isTimerForProject}
                                            onClick={() => void globalStopTimer()}
                                            className="h-8 w-8 rounded-lg bg-[#FFF1F2] text-[#E11D48] hover:bg-[#FFE4E8] disabled:bg-slate-100 disabled:text-slate-300"
                                        >
                                            <Square className="h-3.5 w-3.5 fill-current" />
                                        </Button>
                                    </div>
                                </div>
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
                                                        {start ? formatRelativeDate(start) : "Unknown date"}
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

                        <section className="space-y-3">
                            <h2 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                <History className="h-3.5 w-3.5" />
                                Payment History (Log)
                            </h2>
                            <div className="space-y-2">
                                {isLoadingHistory && paymentHistory.length === 0 ? (
                                    <div className="flex items-center justify-center py-6 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading...</span>
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        No payment records found.
                                    </div>
                                ) : (
                                    paymentHistory.map((entry) => (
                                        <div key={entry.id} className="glass flex items-center justify-between p-3 rounded-2xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                                                    entry.status === "Paid" ? "bg-[#ECFDF5] text-[#10B981]" : "bg-[#FFF1F2] text-[#E11D48]"
                                                )}>
                                                    <CheckCircle className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">Marked as {entry.status}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        {formatRelativeDate(entry.date)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className={cn(
                                                "text-[9px] font-black uppercase tracking-widest border-none",
                                                entry.status === "Paid" ? "bg-[#ECFDF5] text-[#10B981]" : "bg-[#FFF1F2] text-[#E11D48]"
                                            )}>
                                                {entry.status}
                                            </Badge>
                                        </div>
                                    ))
                                )}
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
