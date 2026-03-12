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
    FileDown,
    Loader2,
    Pause,
    Play,
    Plus,
    Expand,
    Pencil,
    Square,
    Target,
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
import { normalizeProjectStatus } from "@/lib/status"
import { updateProject, deleteProject } from "@/lib/actions/projects"
import { logTime } from "@/lib/actions/time"
import { getProjectPaymentHistory } from "@/lib/actions/payment-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTimer } from "@/components/providers/timer-provider"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ProjectWithDetails } from "@/types"
import { Service, Site } from "@prisma/client"

type UpdateProjectPayload = {
    name?: string
    description?: string | null
    status?: "Active" | "Paused" | "Completed" | "Closed"
    paymentStatus?: "Paid" | "Unpaid"
    paidAt?: Date | string | null
    createdAt?: Date | string
    currentFee?: number | null
    serviceIds?: string[]
}

interface ProjectSheetContentProps {
    project: ProjectWithDetails
    allServices: Service[]
    hourlyRate?: number
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

const PROJECT_REQUIREMENTS_TEMPLATE = [
    "<h2>Requirements</h2>",
    "<ul>",
    "<li><strong>Goal:</strong> </li>",
    "<li><strong>Deliverables:</strong> </li>",
    "<li><strong>Tracking scope (GTM / GA4 / Pixel):</strong> </li>",
    "<li><strong>Constraints:</strong> </li>",
    "</ul>",
    "<h3>Implementation Notes</h3>",
    "<p></p>",
    "<h3>Screenshots</h3>",
    "<p></p>",
].join("")

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
    return format(value, "dd MMMM yyyy, HH:mm")
}

function toDateTimeLocalValue(value: Date | null) {
    if (!value) return ""
    return format(value, "yyyy-MM-dd'T'HH:mm")
}

export function ProjectSheetContent({
    project: initialProject,
    allServices,
    hourlyRate = 0,
    onUpdate,
    onOpenSite: _onOpenSite,
    standalone = false,
    onClose,
}: ProjectSheetContentProps) {
    const [project, setProject] = React.useState<ProjectWithDetails>(
        { ...initialProject, status: normalizeProjectStatus(initialProject.status) } as ProjectWithDetails
    )
    const [localName, setLocalName] = React.useState("")
    const [amountInput, setAmountInput] = React.useState("")
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const [isEditingServices, setIsEditingServices] = React.useState(false)
    const [description, setDescription] = React.useState(initialProject.description || "")
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false)
    const [isNotesModalOpen, setIsNotesModalOpen] = React.useState(false)
    const [isEditingCreatedAt, setIsEditingCreatedAt] = React.useState(false)
    const [createdAtInput, setCreatedAtInput] = React.useState("")
    const [manualMinutes, setManualMinutes] = React.useState("")
    const [manualNotes, setManualNotes] = React.useState("")

    const [isLoggingTime, setIsLoggingTime] = React.useState(false)
    const [selectedTimeLog, setSelectedTimeLog] = React.useState<any | null>(null)
    const [isTimeLogSheetOpen, setIsTimeLogSheetOpen] = React.useState(false)
    const [isExportingNotes, setIsExportingNotes] = React.useState(false)
    const [notesSaveState, setNotesSaveState] = React.useState<
        "idle" | "typing" | "saving" | "saved" | "error"
    >("idle")
    const activeProjectIdRef = React.useRef(initialProject.id)
    const isDescriptionSaveInFlightRef = React.useRef(false)
    const queuedDescriptionRef = React.useRef<string | null>(null)
    const lastSavedDescriptionRef = React.useRef(initialProject.description || "")

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
        setProject({ ...initialProject, status: normalizeProjectStatus(initialProject.status) } as ProjectWithDetails)
    }, [initialProject])

    React.useEffect(() => {
        setLocalName(project.name || formatProjectName(project))
    }, [project.name, project.id])

    React.useEffect(() => {
        if (activeProjectIdRef.current === project.id) return
        activeProjectIdRef.current = project.id
        const serverDescription = project.description || ""
        setDescription(serverDescription)
        lastSavedDescriptionRef.current = serverDescription
        queuedDescriptionRef.current = null
        isDescriptionSaveInFlightRef.current = false
        setNotesSaveState("idle")
    }, [project.id, project.description])

    const persistDescription = React.useCallback(
        async (projectId: string, nextDescription: string) => {
            const result = await updateProject(projectId, { description: nextDescription })
            if (!result.success) {
                toast.error(result.error || "Failed to update notes")
                return false
            }

            setProject((previousProject) => {
                if (previousProject.id !== projectId) return previousProject
                return {
                    ...previousProject,
                    description: nextDescription,
                    updatedAt: new Date(),
                } as ProjectWithDetails
            })

            return true
        },
        []
    )

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

    React.useEffect(() => {
        const currentCreatedAt = toDate(project.createdAt)
        setCreatedAtInput(toDateTimeLocalValue(currentCreatedAt))
    }, [project.createdAt, project.id])

    const handleUpdate = React.useCallback(
        async (data: UpdateProjectPayload) => {
            setUpdatingId(project.id)
            try {
                const result = await updateProject(project.id, data as any)
                if (!result.success) {
                    toast.error(result.error || "Update failed")
                    return false
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
                        ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
                        ...(data.currentFee !== undefined ? { currentFee: data.currentFee } : {}),
                        updatedAt: new Date(),
                    } as ProjectWithDetails
                }

                setProject(updatedProject)
                onUpdate?.(updatedProject)

                // Refresh history if payment status changed
                if (data.paymentStatus !== undefined) {
                    fetchPaymentHistory()
                }

                const isDescriptionOnlyUpdate =
                    data.description !== undefined &&
                    Object.keys(data).length === 1

                if (!isDescriptionOnlyUpdate) {
                    router.refresh()
                }
                return true
            } catch {
                toast.error("Update failed")
                return false
            } finally {
                setUpdatingId(null)
            }
        },
        [allServices, onUpdate, project, router, fetchPaymentHistory]
    )

    const isInitialMount = React.useRef(true)
    const triggerDescriptionSave = React.useCallback(
        async (nextDescription: string) => {
            const projectId = activeProjectIdRef.current

            if (isDescriptionSaveInFlightRef.current) {
                queuedDescriptionRef.current = nextDescription
                return
            }

            isDescriptionSaveInFlightRef.current = true
            let descriptionToSave: string | null = nextDescription

            while (descriptionToSave !== null) {
                setNotesSaveState("saving")
                const success = await persistDescription(projectId, descriptionToSave)

                if (success) {
                    lastSavedDescriptionRef.current = descriptionToSave
                    setNotesSaveState("saved")
                } else {
                    setNotesSaveState("error")
                }

                const queuedDescription = queuedDescriptionRef.current
                if (queuedDescription && queuedDescription !== descriptionToSave) {
                    queuedDescriptionRef.current = null
                    descriptionToSave = queuedDescription
                } else {
                    queuedDescriptionRef.current = null
                    descriptionToSave = null
                }
            }

            isDescriptionSaveInFlightRef.current = false
        },
        [persistDescription]
    )

    React.useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        if (description === lastSavedDescriptionRef.current) {
            setNotesSaveState((current) => (current === "idle" ? current : "saved"))
            return
        }

        setNotesSaveState("typing")
        const timer = setTimeout(() => {
            void triggerDescriptionSave(description)
        }, 650)

        return () => clearTimeout(timer)
    }, [description, triggerDescriptionSave])

    const appendRequirementsTemplate = React.useCallback(() => {
        setDescription((current) => {
            if (!current.trim()) return PROJECT_REQUIREMENTS_TEMPLATE
            return `${current}<p></p>${PROJECT_REQUIREMENTS_TEMPLATE}`
        })
    }, [])

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

    const handleCreatedAtSave = () => {
        const parsed = createdAtInput ? new Date(createdAtInput) : null
        if (!parsed || Number.isNaN(parsed.getTime())) {
            toast.error("Please select a valid creation date")
            return
        }
        setIsEditingCreatedAt(false)
        void handleUpdate({ createdAt: parsed })
    }

    const updateProjectStatus = (value: UpdateProjectPayload["status"]) => {
        if (!value || value === project.status) return
        void handleUpdate({ status: value })
    }

    const exportNotesAsPdf = React.useCallback(async () => {
        if (isExportingNotes) return
        setIsExportingNotes(true)
        try {
            const title = project.name || formatProjectName(project)
            const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-")
            const createdLabel = formatBottomDate(toDate(project.createdAt) || null)
            const updatedLabel = formatBottomDate(toDate(project.updatedAt) || null)
            const html = description || ""

            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                import("html2canvas"),
                import("jspdf"),
            ])

            const container = document.createElement("div")
            container.style.width = "800px"
            container.style.padding = "32px"
            container.style.background = "#ffffff"
            container.style.color = "#0f172a"
            container.style.fontFamily =
                "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
            container.innerHTML = `
                <h1 style="font-size:24px;margin:0 0 8px 0;">Project Notes - ${safeTitle}</h1>
                <div style="font-size:12px;color:#64748b;margin-bottom:24px;">
                    Created: ${createdLabel} • Last updated: ${updatedLabel}
                </div>
                <div class="content" style="font-size:13px;line-height:1.6;">
                    ${html || "<p></p>"}
                </div>
            `
            const images = Array.from(container.querySelectorAll("img"))
            for (const img of images) {
                img.style.maxWidth = "70%"
                img.style.height = "auto"
                img.style.border = "1px solid #e2e8f0"
                img.style.borderRadius = "10px"
                img.style.margin = "12px 0"
            }

            container.style.position = "fixed"
            container.style.left = "-9999px"
            container.style.top = "0"
            document.body.appendChild(container)

            await Promise.all(
                images.map(
                    (img) =>
                        new Promise<void>((resolve) => {
                            if (img.complete) {
                                resolve()
                            } else {
                                img.onload = () => resolve()
                                img.onerror = () => resolve()
                            }
                        })
                )
            )

            const canvas = await html2canvas(container, {
                backgroundColor: "#ffffff",
                scale: window.devicePixelRatio || 2,
                useCORS: true,
            })

            document.body.removeChild(container)

            const pdf = new jsPDF("p", "pt", "a4")
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const imgWidth = pageWidth
            const imgHeight = (canvas.height * imgWidth) / canvas.width

            let position = 0
            let remainingHeight = imgHeight
            const imgData = canvas.toDataURL("image/png")

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
            remainingHeight -= pageHeight

            while (remainingHeight > 0) {
                position -= pageHeight
                pdf.addPage()
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
                remainingHeight -= pageHeight
            }

            pdf.save(`Project Notes - ${safeTitle}.pdf`)
        } catch (error) {
            console.error("PDF export failed", error)
            toast.error("Failed to export PDF")
        } finally {
            setIsExportingNotes(false)
        }
    }, [project, description, isExportingNotes])

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
    const lastUpdatedTimestamp = updatedAt || createdAt || null
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
    const budgetInsights = React.useMemo(() => {
        const hourlyRateValue = Number(hourlyRate || 0)
        const feeValue = Number(project.currentFee || 0)
        const hasHourlyRate = hourlyRateValue > 0
        const hasFee = feeValue > 0
        const recommendedHours = hasHourlyRate && hasFee ? feeValue / hourlyRateValue : 0
        const trackedHoursNow = totalTrackedSeconds / 3600
        const remainingHours = recommendedHours - trackedHoursNow
        const isOverBudget = remainingHours < 0
        const progressPercent = recommendedHours > 0 ? (trackedHoursNow / recommendedHours) * 100 : 0

        return {
            hasHourlyRate,
            hasFee,
            feeValue,
            recommendedHours,
            trackedHoursNow,
            remainingHours,
            isOverBudget,
            progressPercent,
            progressBarPercent: Math.max(0, Math.min(progressPercent, 100)),
        }
    }, [hourlyRate, project.currentFee, totalTrackedSeconds])

    return (
        <TaskSheetWrapper tasks={project.tasks || []} project={project}>
            <div className="relative flex h-full flex-col overflow-hidden bg-[#f8fafc]">
                <div className="absolute right-8 top-8 z-20 flex items-center gap-2">
                    {!standalone && onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                            aria-label="Close project"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-6 pt-10">
                    <div className="mx-auto max-w-[980px] space-y-4 pb-12">
                        <div className="space-y-3 pr-4 pt-1 pb-1">
                            {isEditingTitle ? (
                                <Textarea
                                    value={localName}
                                    onChange={(event) => setLocalName(event.target.value)}
                                    className="min-h-[48px] resize-none !rounded-none !border-0 !border-b !border-slate-200 !bg-transparent !px-0 !pt-0 !pb-2 text-2xl font-bold leading-tight tracking-[-0.03em] text-slate-900 !shadow-none focus-visible:!border-b-2 focus-visible:!border-blue-300 focus-visible:!ring-0 md:text-3xl"
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
                                <div className="group flex w-full items-start gap-3 py-1">
                                    <div className="min-w-0 flex-1">
                                        <h1 className="text-xl font-bold leading-tight tracking-[-0.03em] text-slate-900 md:text-2xl">
                                            {localName || formatProjectName(project)}
                                        </h1>
                                        <span
                                            className={cn(
                                                "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-all",
                                                project.services?.some((service) => service.isRecurring)
                                                    ? "border-blue-200/60 bg-blue-50/50 text-blue-600"
                                                    : "border-emerald-200/60 bg-emerald-50/50 text-emerald-600"
                                            )}
                                        >
                                            {format(toDate(project.createdAt) || new Date(), "MMMM yyyy")}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsEditingTitle(true)}
                                        className="mt-0.5 h-8 w-8 shrink-0 rounded-lg text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label="Edit project title"
                                        title="Edit project title"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {updatingId === project.id && (
                                <div className="text-xs font-medium text-slate-400">
                                    <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                                    Updating...
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="flex min-h-[78px] items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/status relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-4 transition-all duration-300 active:scale-[0.98]",
                                                project.status === "Active" && "border-blue-200/50 bg-gradient-to-br from-blue-50/80 to-blue-100/50 text-blue-600 shadow-[0_2px_10px_-4px_rgba(37,99,235,0.15)] hover:border-blue-300/60",
                                                project.status === "Paused" && "border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-amber-100/50 text-amber-600 shadow-[0_2px_10px_-4px_rgba(217,119,6,0.15)] hover:border-amber-300/60",
                                                project.status === "Completed" && "border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 text-emerald-600 shadow-[0_2px_10px_-4px_rgba(16,185,129,0.15)] hover:border-emerald-300/60",
                                                project.status === "Closed" && "border-slate-200/50 bg-gradient-to-br from-slate-50/80 to-slate-100/50 text-slate-600 shadow-[0_2px_10px_-4px_rgba(71,85,105,0.15)] hover:border-slate-300/60"
                                            )}
                                        >
                                            <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover/status:translate-y-0" />
                                            {project.status === "Active" && <Play className="relative z-10 h-3.5 w-3.5 fill-current" />}
                                            {project.status === "Paused" && <Pause className="relative z-10 h-3.5 w-3.5" />}
                                            {project.status === "Completed" && <Check className="relative z-10 h-3.5 w-3.5" />}
                                            {project.status === "Closed" && <Square className="relative z-10 h-3.5 w-3.5 fill-current" />}
                                            <span className="relative z-10 text-[13px] font-bold tracking-[0.01em]">{project.status}</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                        {(["Active", "Paused", "Completed", "Closed"] as const).map((statusOption) => (
                                            <DropdownMenuItem
                                                key={statusOption}
                                                onSelect={() => updateProjectStatus(statusOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                            >
                                                <span className={cn(
                                                    "mr-2 h-2 w-2 rounded-full",
                                                    statusOption === "Active" && "bg-blue-500",
                                                    statusOption === "Paused" && "bg-amber-500",
                                                    statusOption === "Completed" && "bg-emerald-500",
                                                    statusOption === "Closed" && "bg-slate-500"
                                                )} />
                                                {statusOption}
                                                {project.status === statusOption && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex min-h-[78px] items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "group/payment relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full border px-4 transition-all duration-300 active:scale-[0.98]",
                                                project.paymentStatus === "Paid" 
                                                    ? "border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 text-emerald-600 shadow-[0_2px_10px_-4px_rgba(16,185,129,0.15)] hover:border-emerald-300/60" 
                                                    : "border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-rose-100/50 text-rose-600 shadow-[0_2px_10px_-4px_rgba(225,29,72,0.15)] hover:border-rose-300/60"
                                            )}
                                        >
                                            <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover/payment:translate-y-0" />
                                            <span className={cn(
                                                "relative z-10 h-2.5 w-2.5 rounded-full shadow-sm", 
                                                project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                            )} />
                                            <span className="relative z-10 text-[13px] font-bold tracking-[0.01em]">{project.paymentStatus}</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                        {(["Paid", "Unpaid"] as const).map((paymentOption) => (
                                            <DropdownMenuItem
                                                key={paymentOption}
                                                onSelect={() => updateProjectPaymentStatus(paymentOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
                                            >
                                                <span className={cn("mr-2 h-2 w-2 rounded-full", paymentOption === "Paid" ? "bg-emerald-500" : "bg-rose-500")} />
                                                {paymentOption}
                                                {project.paymentStatus === paymentOption && <Check className="ml-auto h-3.5 w-3.5 text-slate-500" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex min-h-[78px] flex-col justify-center">
                                <div className="group/amount relative flex h-11 items-center overflow-hidden rounded-full border border-slate-200/80 bg-white px-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-blue-200 hover:shadow-[0_4px_12px_-4px_rgba(37,99,235,0.08)]">
                                    <Input
                                        type="number"
                                        step={1}
                                        value={amountInput}
                                        onChange={(event) => setAmountInput(event.target.value)}
                                        onBlur={handleAmountBlur}
                                        className="relative z-10 h-auto border-none bg-transparent p-0 text-center text-xl font-black tracking-[-0.02em] text-slate-900 shadow-none focus-visible:ring-0 md:text-[24px]"
                                        placeholder="0"
                                    />
                                    <span className="relative z-10 ml-3 inline-flex items-center rounded-full bg-slate-100/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 transition-colors group-hover/amount:bg-blue-50 group-hover/amount:text-blue-600">RON</span>
                                </div>
                            </div>
                        </div>

                        <section className="space-y-3 border-t border-slate-200/80 pt-4">
                            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Project Tasks</h2>
                            <ProjectTasks projectId={project.id} initialTasks={project.tasks || []} />
                        </section>

                        <section className="space-y-3 border-t border-slate-200/80 pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Project Notes</h2>
                                <span
                                    className={cn(
                                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em]",
                                        notesSaveState === "error" &&
                                        "border-rose-200 bg-rose-50 text-rose-600",
                                        notesSaveState === "saving" &&
                                        "border-blue-200 bg-blue-50 text-blue-600",
                                        notesSaveState === "typing" &&
                                        "border-slate-200 bg-slate-100 text-slate-500",
                                        notesSaveState === "saved" &&
                                        "border-emerald-200 bg-emerald-50 text-emerald-600",
                                        notesSaveState === "idle" &&
                                        "border-slate-200 bg-slate-100 text-slate-500"
                                    )}
                                >
                                    {notesSaveState === "saving" && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {notesSaveState === "saved" && (
                                        <CheckCircle className="h-3.5 w-3.5" />
                                    )}
                                    {notesSaveState === "error" && (
                                        <AlertCircle className="h-3.5 w-3.5" />
                                    )}
                                    {notesSaveState === "idle" && "Ready"}
                                    {notesSaveState === "typing" && "Typing"}
                                    {notesSaveState === "saving" && "Saving"}
                                    {notesSaveState === "saved" && "Saved"}
                                    {notesSaveState === "error" && "Error"}
                                </span>
                            </div>

                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder=""
                                variant="plain"
                                mode="document"
                                className="rounded-[22px] bg-white"
                                minHeightClassName="h-[360px]"
                                uploadProjectId={project.id}
                                toolbarVisibility="always"
                                toolbarActions={
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={appendRequirementsTemplate}
                                            className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            aria-label="Add template"
                                            title="Add template"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={exportNotesAsPdf}
                                            disabled={isExportingNotes}
                                            className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            aria-label="Export notes as PDF"
                                            title="Export notes as PDF"
                                        >
                                            {isExportingNotes ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsNotesModalOpen(true)}
                                            className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            aria-label="Open in modal"
                                            title="Open in modal"
                                        >
                                            <Expand className="h-4 w-4" />
                                        </Button>
                                    </>
                                }
                            />
                        </section>

                        <section className="space-y-2 border-t border-slate-200/80 pt-4">
                            <div className="flex items-center justify-between">
                                <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                    <Target className="h-3.5 w-3.5" />
                                    Hour Recommendation
                                </h2>
                                {budgetInsights.hasHourlyRate && budgetInsights.hasFee && (
                                    <span
                                        className={cn(
                                            "inline-flex h-7 items-center rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.08em]",
                                            budgetInsights.isOverBudget
                                                ? "border-rose-200 bg-rose-50 text-rose-600"
                                                : "border-emerald-200 bg-emerald-50 text-emerald-600"
                                        )}
                                    >
                                        {budgetInsights.isOverBudget ? "Over Budget" : "On Track"}
                                    </span>
                                )}
                            </div>

                            {!budgetInsights.hasHourlyRate ? (
                                <div className="rounded-[26px] border border-dashed border-slate-200 bg-white px-4 py-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hourly Budget</p>
                                    <p className="mt-1 text-sm font-medium text-slate-600">
                                        Set your hourly rate to enable fee based hour recommendations.
                                    </p>
                                    <Link href="/settings" className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-500">
                                        Open Settings
                                    </Link>
                                </div>
                            ) : !budgetInsights.hasFee ? (
                                <div className="rounded-[26px] border border-dashed border-slate-200 bg-white px-4 py-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hourly Budget</p>
                                    <p className="mt-1 text-sm font-medium text-slate-600">
                                        Set project amount to compute recommended hours.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <div className="overflow-x-auto">
                                        <div className="flex min-w-[640px] items-center gap-3">
                                            <div className="shrink-0">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-500">Recommended</p>
                                                <p className="mt-1 font-mono text-xl font-black tabular-nums text-blue-700">
                                                    {budgetInsights.recommendedHours.toFixed(1)}h
                                                </p>
                                            </div>

                                            <div className="h-10 w-px shrink-0 bg-slate-200" />

                                            <div className="shrink-0">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Tracked</p>
                                                <p className="mt-1 font-mono text-xl font-black tabular-nums text-slate-800">
                                                    {budgetInsights.trackedHoursNow.toFixed(1)}h
                                                </p>
                                            </div>

                                            <div className="h-10 w-px shrink-0 bg-slate-200" />

                                            <div className="shrink-0">
                                                <p className={cn(
                                                    "text-[10px] font-bold uppercase tracking-[0.08em]",
                                                    budgetInsights.isOverBudget ? "text-rose-500" : "text-emerald-500"
                                                )}>
                                                    {budgetInsights.isOverBudget ? "Overrun" : "Remaining"}
                                                </p>
                                                <p className={cn(
                                                    "mt-1 font-mono text-xl font-black tabular-nums",
                                                    budgetInsights.isOverBudget ? "text-rose-700" : "text-emerald-700"
                                                )}>
                                                    {Math.abs(budgetInsights.remainingHours).toFixed(1)}h
                                                </p>
                                            </div>

                                            <div className="h-10 w-px shrink-0 bg-slate-200" />

                                            <div className="min-w-[240px] flex-1">
                                                <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                                                    <span>Progress</span>
                                                    <span>{budgetInsights.progressPercent.toFixed(0)}%</span>
                                                </div>
                                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-500",
                                                            budgetInsights.isOverBudget
                                                                ? "bg-rose-500"
                                                                : budgetInsights.progressPercent > 80
                                                                    ? "bg-amber-500"
                                                                    : "bg-emerald-500"
                                                        )}
                                                        style={{ width: `${budgetInsights.progressBarPercent}%` }}
                                                    />
                                                </div>
                                                <p className="mt-1 text-right text-[11px] font-medium text-slate-500">
                                                    {new Intl.NumberFormat("ro-RO", {
                                                        style: "currency",
                                                        currency: "RON",
                                                        maximumFractionDigits: 0,
                                                    }).format(budgetInsights.feeValue)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>


                        <section className="space-y-2 border-t border-slate-200/80 pt-4">
                            <div className="flex items-center justify-between">
                                <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Recent Time Logs
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsManualTimeOpen((current) => !current)}
                                    className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-50"
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add Time
                                </Button>
                            </div>

                            <div className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
                                <div className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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

                            <div className="space-y-1.5">
                                {recentLogs.length === 0 && (
                                    <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
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
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
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

                        <section className="space-y-2 border-t border-slate-200/80 pt-4">
                            <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                <History className="h-3.5 w-3.5" />
                                Payment History (Log)
                            </h2>
                            <div className="space-y-1.5">
                                {isLoadingHistory && paymentHistory.length === 0 ? (
                                    <div className="flex items-center justify-center py-6 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading...</span>
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        No payment records found.
                                    </div>
                                ) : (
                                    paymentHistory.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5">
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

                        <section className="space-y-3 border-t border-slate-200/80 pt-4">
                            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Project Info</h2>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Link
                                    href={`/vault/${project.site.partner.id}`}
                                    className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300"
                                >
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Partner</p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <p className="truncate text-base font-black leading-tight tracking-tight text-slate-800 sm:text-lg">
                                            {project.site.partner.name}
                                        </p>
                                        <FolderOpen className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
                                    </div>
                                </Link>

                                <Link
                                    href={`/vault/${project.site.partner.id}/${project.site.id}`}
                                    className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300"
                                >
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Domain</p>
                                    <div className="mt-1 flex items-center justify-between gap-3">
                                        <p className="truncate text-base font-black leading-tight tracking-tight text-slate-800 sm:text-lg">
                                            {project.site.domainName}
                                        </p>
                                        <Globe className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
                                    </div>
                                </Link>
                            </div>

                            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Project Services</p>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingServices((current) => !current)}
                                        className="rounded-full border border-slate-300 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
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
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100/70"
                                        >
                                            {service.serviceName}
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isEditingServices && (
                                <div className="rounded-[26px] border border-slate-200 bg-white p-4">
                                    <div className="grid gap-4 md:grid-cols-2">
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
                        </section>

                        <section className="flex justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="h-9 rounded-full border border-rose-200 bg-rose-50 px-4 text-xs font-bold uppercase tracking-[0.08em] text-rose-600 hover:bg-rose-100"
                            >
                                {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                                Delete
                            </Button>
                        </section>

                        <div className="mt-12 border-t border-slate-200 pt-8 text-[11px] font-semibold text-slate-400">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <span># Project ID: {project.id.split("-")[0]}</span>
                                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                                    <span className="inline-flex items-center gap-1.5">
                                        Created:
                                        {isEditingCreatedAt ? (
                                            <>
                                                <Input
                                                    type="datetime-local"
                                                    value={createdAtInput}
                                                    onChange={(e) => setCreatedAtInput(e.target.value)}
                                                    className="h-7 w-[210px] border-slate-200 bg-white px-2 py-1 text-[11px]"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCreatedAtSave}
                                                    className="text-blue-600 hover:text-blue-500"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCreatedAtInput(toDateTimeLocalValue(toDate(project.createdAt)))
                                                        setIsEditingCreatedAt(false)
                                                    }}
                                                    className="text-slate-500 hover:text-slate-700"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span>{formatBottomDate(toDate(project.createdAt))}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingCreatedAt(true)}
                                                    className="text-slate-400 transition hover:text-slate-700"
                                                    aria-label="Edit created date"
                                                    title="Edit created date"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </span>
                                    {lastUpdatedTimestamp && (
                                        <span className="inline-flex items-center gap-1.5 border-l border-slate-200 pl-3">
                                            Last Updated: {formatBottomDate(lastUpdatedTimestamp)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
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

                <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
                    <DialogContent
                        showCloseButton={false}
                        overlayClassName="bg-slate-900/18 backdrop-blur-[6px]"
                        className="h-[92vh] w-[94vw] max-w-[94vw] overflow-hidden rounded-2xl border border-slate-200/80 bg-[#FCFCFB] p-0 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.7)] sm:w-[65vw] sm:min-w-[65vw] sm:max-w-[65vw]"
                    >
                        <DialogHeader className="border-b border-slate-200/70 px-8 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-lg font-semibold tracking-[-0.01em] text-slate-900">
                                        Project Notes - {project.name || formatProjectName(project)}
                                    </DialogTitle>
                                    <span className="mt-2 inline-flex min-w-[140px] items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                        {notesSaveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                                        {notesSaveState === "saved" && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                                        {notesSaveState === "error" && <AlertCircle className="h-3.5 w-3.5 text-rose-500" />}
                                        {notesSaveState === "saving"
                                            ? "Saving..."
                                            : notesSaveState === "saved"
                                                ? "Saved"
                                                : notesSaveState === "error"
                                                    ? "Error"
                                                    : "Auto-save enabled"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-11 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Close
                                        </Button>
                                    </DialogClose>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex h-[calc(92vh-81px)] flex-col overflow-hidden bg-[#FCFCFB] px-8 pb-8 pt-6">
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder=""
                                variant="plain"
                                mode="document"
                                className="h-full"
                                minHeightClassName="min-h-0"
                                uploadProjectId={project.id}
                                toolbarVisibility="always"
                                toolbarActions={
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={appendRequirementsTemplate}
                                            className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            aria-label="Add template"
                                            title="Add template"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={exportNotesAsPdf}
                                            disabled={isExportingNotes}
                                            className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            aria-label="Export notes as PDF"
                                            title="Export notes as PDF"
                                        >
                                            {isExportingNotes ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </>
                                }
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TaskSheetWrapper>
    )
}
