"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
    AlertCircle,
    ArrowRight,
    CalendarRange,
    Check,
    CheckCircle,
    ChevronDown,
    Clock3,
    FileDown,
    Loader2,
    Pause,
    Play,
    Plus,
    Pencil,
    Square,
    Target,
    X,
    FileText,
    ListTodo,
    Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { cn, formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import { updateProject, deleteProject, reopenRecurringProject } from "@/lib/actions/projects"
import { logTime } from "@/lib/actions/time"
import { getProjectPaymentHistory, getProjectStatusHistory } from "@/lib/actions/payment-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTimer } from "@/components/providers/timer-provider"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { SidePanelManualTimeForm } from "@/components/shared/side-panel-manual-time-form"
import { SidePanelNotesSection } from "@/components/shared/side-panel-notes-section"
import { SidePanelTimeLogHistoryList } from "@/components/shared/side-panel-time-log-history-list"
import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { TimeTrackerWidget } from "@/components/shared/time-tracker-widget"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ProjectWithDetails } from "@/types"
import { normalizeExternalHttpUrl } from "@/lib/external-url"
import { Service, Site } from "@prisma/client"
import { SidePanelDetailRow, SidePanelSectionTitle, SidePanelTabs } from "@/components/ui/side-panel-primitives"
import { SIDE_PANEL_DIALOG_HEADER_CLASS, sidePanelDialogContentClass } from "@/lib/ui/side-panels"
import { ProjectHistoryLogSections, type ProjectPaymentHistoryEntry, type ProjectStatusHistoryEntry } from "@/components/projects/project-history-log-sections"
import { ProjectSheetInfoSection } from "@/components/projects/project-sheet-info-section"
import { CloseProjectDialog } from "@/components/projects/close-project-dialog"
import { RecurringProjectMonthPicker } from "@/components/projects/recurring-project-month-picker"
import {
    formatMonthKeyLabel,
    getDefaultRecurringMonth,
    getMinimumRecurringMonth,
} from "@/lib/projects/recurring-month"
import {
    markProjectNoteDraftSaved,
    recordProjectNoteDraft,
    resolveProjectNoteDraftContent,
} from "@/lib/notes/workspace-state"
import { NOTES_WRITE_PROTOCOL_VERSION } from "@/lib/notes/write-protocol"
import { normalizeRichTextContent } from "@/lib/notes/content"

type UpdateProjectPayload = {
    name?: string
    description?: string | null
    status?: "Active" | "Paused" | "Completed" | "Closed"
    paymentStatus?: "Paid" | "Unpaid"
    paidAt?: Date | string | null
    closedAt?: Date | string | null
    isHeavyRevenueMonth?: boolean
    createdAt?: Date | string
    currentFee?: number | null
    feeScope?: "CURRENT_MONTH" | "CURRENT_AND_FUTURE" | "FUTURE_MONTHS"
    serviceIds?: string[]
}

type ProjectTimeLogWithTask = ProjectWithDetails["timeLogs"][number] & {
    task?: {
        name?: string | null
    } | null
}

interface ProjectSheetContentProps {
    project: ProjectWithDetails
    allServices: Service[]
    hourlyRate?: number
    onUpdate?: (updatedProject: ProjectWithDetails) => void
    onOpenSite?: (site: Site) => void
    onOpenPartner?: (partnerId: string) => void
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

function formatHoursWithMinutes(totalHours: number) {
    if (!Number.isFinite(totalHours)) return "0m"
    const totalMinutes = Math.max(0, Math.round(totalHours * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours === 0) return `${minutes}m`
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
}

function formatBottomDate(value: Date | null) {
    if (!value) return "—"
    return format(value, "dd MMMM yyyy, HH:mm")
}

function sanitizeNotesHtmlForExport(rawHtml: string) {
    if (!rawHtml) return ""
    if (typeof document === "undefined") return rawHtml

    const template = document.createElement("template")
    template.innerHTML = rawHtml

    const blockedTags = ["script", "iframe", "object", "embed", "link", "meta"]
    blockedTags.forEach((tag) => {
        template.content.querySelectorAll(tag).forEach((element) => element.remove())
    })

    const allowedSrcPrefixes = ["http://", "https://", "/", "data:image/", "blob:"]
    template.content.querySelectorAll("*").forEach((element) => {
        const attributes = Array.from(element.attributes)
        attributes.forEach((attribute) => {
            const attrName = attribute.name.toLowerCase()
            const attrValue = attribute.value.trim()
            const normalizedValue = attrValue.toLowerCase()

            if (attrName.startsWith("on")) {
                element.removeAttribute(attribute.name)
                return
            }

            if (attrName === "href" || attrName === "src" || attrName === "xlink:href") {
                const isAllowed = allowedSrcPrefixes.some((prefix) =>
                    normalizedValue.startsWith(prefix)
                )
                if (!isAllowed) {
                    element.removeAttribute(attribute.name)
                }
            }
        })
    })

    return template.innerHTML
}

function toDateTimeLocalValue(value: Date | null) {
    if (!value) return ""
    return format(value, "yyyy-MM-dd'T'HH:mm")
}

function toDateInputValue(value: Date | string | null | undefined) {
    const parsed = toDate(value)
    if (!parsed) return undefined
    return format(parsed, "yyyy-MM-dd")
}

export function ProjectSheetContent({
    project: initialProject,
    allServices,
    hourlyRate = 0,
    onUpdate,
    onOpenSite,
    onOpenPartner,
    standalone = false,
    onClose,
}: ProjectSheetContentProps) {
    const [project, setProject] = React.useState<ProjectWithDetails>(
        { ...initialProject, status: normalizeProjectStatus(initialProject.status) } as ProjectWithDetails
    )
    const [localName, setLocalName] = React.useState("")
    const [amountInput, setAmountInput] = React.useState("")
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState("overview")
    const [description, setDescription] = React.useState(initialProject.description || "")
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isManualTimeOpen, setIsManualTimeOpen] = React.useState(false)
    const [isNotesModalOpen, setIsNotesModalOpen] = React.useState(false)
    const [isEditingCreatedAt, setIsEditingCreatedAt] = React.useState(false)
    const [createdAtInput, setCreatedAtInput] = React.useState("")
    const [manualMinutes, setManualMinutes] = React.useState("")
    const [manualNotes, setManualNotes] = React.useState("")
    const [isCloseProjectDialogOpen, setIsCloseProjectDialogOpen] = React.useState(false)
    const [isSubmittingCloseProject, setIsSubmittingCloseProject] = React.useState(false)
    const [isReopenRecurringDialogOpen, setIsReopenRecurringDialogOpen] = React.useState(false)
    const [reopenMonth, setReopenMonth] = React.useState(() =>
        getDefaultRecurringMonth(initialProject.createdAt)
    )
    const [isReopeningRecurring, setIsReopeningRecurring] = React.useState(false)

    const [isLoggingTime, setIsLoggingTime] = React.useState(false)
    const [selectedTimeLog, setSelectedTimeLog] = React.useState<ProjectTimeLogWithTask | null>(null)
    const [isTimeLogSheetOpen, setIsTimeLogSheetOpen] = React.useState(false)
    const [isExportingNotes, setIsExportingNotes] = React.useState(false)
    const [notesSaveState, setNotesSaveState] = React.useState<
        "idle" | "typing" | "saving" | "saved" | "error"
    >("idle")
    const activeProjectIdRef = React.useRef("")
    const isDescriptionSaveInFlightRef = React.useRef(false)
    const queuedDescriptionRef = React.useRef<string | null>(null)
    const lastSavedDescriptionRef = React.useRef(initialProject.description || "")
    const descriptionRef = React.useRef(initialProject.description || "")

    // Payment History State
    const [paymentHistory, setPaymentHistory] = React.useState<ProjectPaymentHistoryEntry[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
    const [statusHistory, setStatusHistory] = React.useState<ProjectStatusHistoryEntry[]>([])
    const [isLoadingStatusHistory, setIsLoadingStatusHistory] = React.useState(false)
    const [hasLoadedHistory, setHasLoadedHistory] = React.useState(false)
    const activeSidebarProjectIdRef = React.useRef(initialProject.id)

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
        if (activeSidebarProjectIdRef.current !== initialProject.id) {
            activeSidebarProjectIdRef.current = initialProject.id
            setActiveTab("overview")
            setHasLoadedHistory(false)
            setPaymentHistory([])
            setStatusHistory([])
        }
    }, [initialProject])

    React.useEffect(() => {
        setLocalName(formatProjectName(project))
    }, [project])

    React.useEffect(() => {
        if (activeProjectIdRef.current === project.id) return
        activeProjectIdRef.current = project.id
        const serverDescription = normalizeRichTextContent(project.description)
        const recoveredDraft = resolveProjectNoteDraftContent(
            window.sessionStorage,
            project.id,
            serverDescription
        )
        const nextDescription = recoveredDraft ?? serverDescription
        setDescription(nextDescription)
        descriptionRef.current = nextDescription
        lastSavedDescriptionRef.current = serverDescription
        queuedDescriptionRef.current = null
        isDescriptionSaveInFlightRef.current = false
        setNotesSaveState("idle")
    }, [project.id, project.description])

    const persistDescription = React.useCallback(
        async (projectId: string, nextDescription: string) => {
            const result = await updateProject(
                projectId,
                { description: nextDescription },
                {
                    expectedDescription: lastSavedDescriptionRef.current,
                    notesWriteProtocol: NOTES_WRITE_PROTOCOL_VERSION,
                }
            )
            if (!result.success) {
                toast.error(result.error || "Failed to update notes")
                return false
            }
            markProjectNoteDraftSaved(window.sessionStorage, projectId, nextDescription)

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

    const handleDescriptionChange = React.useCallback((nextDescription: string) => {
        nextDescription = normalizeRichTextContent(nextDescription)
        descriptionRef.current = nextDescription
        setDescription(nextDescription)
        recordProjectNoteDraft(
            window.sessionStorage,
            activeProjectIdRef.current,
            nextDescription,
            lastSavedDescriptionRef.current
        )
    }, [])

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

    const fetchStatusHistory = React.useCallback(async () => {
        setIsLoadingStatusHistory(true)
        try {
            const result = await getProjectStatusHistory(project.id)
            if (result.success) {
                setStatusHistory(result.data || [])
            }
        } catch (error) {
            console.error("Failed to load status history", error)
        } finally {
            setIsLoadingStatusHistory(false)
        }
    }, [project.id])

    React.useEffect(() => {
        if (activeTab !== "activity" || hasLoadedHistory) return
        let cancelled = false
        void Promise.all([fetchPaymentHistory(), fetchStatusHistory()]).then(() => {
            if (!cancelled) setHasLoadedHistory(true)
        })
        return () => { cancelled = true }
    }, [activeTab, fetchPaymentHistory, fetchStatusHistory, hasLoadedHistory])

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
                const result = await updateProject(project.id, data)
                if (!result.success) {
                    toast.error(result.error || "Update failed")
                    return false
                }

                const nextPaidAt =
                    data.paidAt !== undefined
                        ? data.paidAt
                            ? toDate(data.paidAt)
                            : null
                        : project.paidAt
                const updatedProject: ProjectWithDetails = {
                    ...project,
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {}),
                    ...(data.status !== undefined ? { status: data.status } : {}),
                    ...(data.paymentStatus !== undefined ? { paymentStatus: data.paymentStatus } : {}),
                    ...(data.paidAt !== undefined ? { paidAt: nextPaidAt } : {}),
                    ...(data.closedAt !== undefined
                        ? { closedAt: data.closedAt ? toDate(data.closedAt) : null }
                        : {}),
                    ...(data.isHeavyRevenueMonth !== undefined
                        ? { isHeavyRevenueMonth: data.isHeavyRevenueMonth }
                        : {}),
                    ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
                    ...(data.currentFee !== undefined && data.feeScope !== "FUTURE_MONTHS"
                        ? { currentFee: data.currentFee }
                        : {}),
                    ...((data.feeScope === "CURRENT_AND_FUTURE" || data.feeScope === "FUTURE_MONTHS") && data.currentFee !== undefined
                        ? { recurringBaseFee: data.currentFee }
                        : {}),
                    ...(data.serviceIds
                        ? { services: allServices.filter((service) => data.serviceIds?.includes(service.id)) }
                        : {}),
                    updatedAt: new Date(),
                } as ProjectWithDetails

                setProject(updatedProject)
                onUpdate?.(updatedProject)

                // Refresh history if payment status changed
                if (data.paymentStatus !== undefined) {
                    setHasLoadedHistory(false)
                }
                if (data.status !== undefined) {
                    setHasLoadedHistory(false)
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
        [allServices, onUpdate, project, router]
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
                if (queuedDescription !== null && queuedDescription !== descriptionToSave) {
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

    const flushDescriptionSave = React.useCallback(() => {
        const currentDescription = descriptionRef.current
        if (currentDescription === lastSavedDescriptionRef.current) return
        void triggerDescriptionSave(currentDescription)
    }, [triggerDescriptionSave])

    React.useEffect(() => {
        const flushWhenHidden = () => {
            if (document.visibilityState === "hidden") flushDescriptionSave()
        }
        window.addEventListener("pagehide", flushDescriptionSave)
        document.addEventListener("visibilitychange", flushWhenHidden)
        return () => {
            window.removeEventListener("pagehide", flushDescriptionSave)
            document.removeEventListener("visibilitychange", flushWhenHidden)
            flushDescriptionSave()
        }
    }, [flushDescriptionSave])

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
        const current = descriptionRef.current
        handleDescriptionChange(
            !current.trim()
                ? PROJECT_REQUIREMENTS_TEMPLATE
                : `${current}<p></p>${PROJECT_REQUIREMENTS_TEMPLATE}`
        )
    }, [handleDescriptionChange])

    const toggleService = (serviceId: string) => {
        const currentIds = (project.services || []).map((service) => service.id)
        const currentServices = allServices.filter((service) => currentIds.includes(service.id))

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
                        icon: <AlertCircle className="h-4 w-4 text-[var(--state-urgent)]" />,
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
        const current = formatProjectName(project)

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
        if (value === "Closed") {
            setIsCloseProjectDialogOpen(true)
            return
        }
        if (
            value === "Active"
            && isRecurringProject
            && (project.status === "Closed" || project.status === "Completed")
        ) {
            setReopenMonth(getDefaultRecurringMonth(project.createdAt))
            setIsReopenRecurringDialogOpen(true)
            return
        }
        void handleUpdate({ status: value })
    }

    const handleReopenRecurring = async () => {
        const match = reopenMonth.match(/^(\d{4})-(\d{2})$/)
        if (!match) {
            toast.error("Choose a valid month")
            return
        }
        setIsReopeningRecurring(true)
        try {
            const result = await reopenRecurringProject({
                projectId: project.id,
                targetYear: Number(match[1]),
                targetMonth: Number(match[2]),
            })
            if (!result.success || !result.data) {
                toast.error(result.error || "Failed to open recurring project")
                return
            }
            setIsReopenRecurringDialogOpen(false)
            toast.success(result.data.created ? "Monthly project created" : "Monthly project reopened")
            if (!standalone) onClose?.()
            router.push(standalone
                ? `/projects/${result.data.projectId}`
                : `/projects?status=Active&projectId=${result.data.projectId}`)
            router.refresh()
        } finally {
            setIsReopeningRecurring(false)
        }
    }

    const handleCloseProjectConfirm = React.useCallback(
        async ({ closedOn, isHeavyRevenueMonth }: { closedOn: string; isHeavyRevenueMonth: boolean }) => {
            setIsSubmittingCloseProject(true)
            try {
                const success = await handleUpdate({
                    status: "Closed",
                    closedAt: closedOn,
                    isHeavyRevenueMonth,
                })
                if (success) {
                    setIsCloseProjectDialogOpen(false)
                }
            } finally {
                setIsSubmittingCloseProject(false)
            }
        },
        [handleUpdate]
    )

    const exportNotesAsPdf = React.useCallback(async () => {
        if (isExportingNotes) return
        setIsExportingNotes(true)
        try {
            const title = formatProjectName(project)
            const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-")
            const createdLabel = formatBottomDate(toDate(project.createdAt) || null)
            const updatedLabel = formatBottomDate(toDate(project.updatedAt) || null)
            const html = sanitizeNotesHtmlForExport(description || "")

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
                "\"Plus Jakarta Sans\", -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
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
        const actionLabel = value === "Paid" ? "mark this project as paid" : "revert this project to unpaid"
        if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) return
        void handleUpdate({
            paymentStatus: value,
            paidAt: value === "Paid" ? new Date() : null,
        })
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this project permanently?")) {
            return
        }

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
    const currentSessionSeconds = isTimerForProject ? timerState.elapsedSeconds : 0
    const totalTrackedSeconds = logsSeconds + currentSessionSeconds
    const isProjectTimerRunning = isTimerForProject && timerState.isRunning
    const isProjectTimerPaused = isTimerForProject && !timerState.isRunning
    const timerStatusLabel = isProjectTimerRunning ? "Running" : isProjectTimerPaused ? "Paused" : "Ready"
    const loggedHours = Math.floor(logsSeconds / 3600)
    const loggedMinutes = Math.floor((logsSeconds % 3600) / 60)
    const handleTimerPrimaryAction = () => {
        if (isTimerForProject) {
            if (timerState.isRunning) {
                void globalPauseTimer()
            } else {
                void globalResumeTimer()
            }
            return
        }

        void globalStartTimer(project.id, undefined, formatProjectName(project))
    }

    const recentLogs = [...((project.timeLogs || []) as ProjectTimeLogWithTask[])].sort((a, b) => {
        const left = toDate(a.startTime)?.getTime() || 0
        const right = toDate(b.startTime)?.getTime() || 0
        return right - left
    })

    const recurringServices = allServices.filter((service) => service.isRecurring)
    const oneTimeServices = allServices.filter((service) => !service.isRecurring)
    const externalSiteUrl = normalizeExternalHttpUrl(project.site?.domainName)
    const sitePanelHref = `/partners/${project.site.partner.id}/${project.site.id}`
    const createdAt = toDate(project.createdAt)
    const updatedAt = toDate(project.updatedAt)
    const lastUpdatedTimestamp = updatedAt || createdAt || null
    const timeLogProjects = React.useMemo(
        () => [{ id: project.id, displayName: localName || formatProjectName(project) }],
        [localName, project]
    )
    const timeLogTasks = React.useMemo(
        () =>
            (project.tasks || []).map((task: ProjectWithDetails["tasks"][number]) => ({
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
    const isRecurringProject = project.services?.some((service) => service.isRecurring) ?? false
    const minimumReopenMonth = getMinimumRecurringMonth(project.createdAt)
    const reopenMonthLabel = formatMonthKeyLabel(reopenMonth)
    const activeProjectTasks = (project.tasks || []).filter((task) => task.status !== "Completed")
    const handleTabChange = (nextTab: string) => {
        if (nextTab === activeTab) return true
        flushDescriptionSave()
        setActiveTab(nextTab)
        return true
    }

    const handleClose = () => {
        flushDescriptionSave()
        onClose?.()
    }

    const statusHistoryEntries = React.useMemo(() => {
        const hasCreatedEntry = statusHistory.some((entry) => entry.action === "PROJECT_CREATED")
        const createdAtDate = toDate(project.createdAt)

        if (hasCreatedEntry || !createdAtDate) return statusHistory

        const fallbackCreatedEntry: ProjectStatusHistoryEntry = {
            id: `project-created-${project.id}`,
            action: "PROJECT_CREATED",
            date: createdAtDate,
            fromStatus: null,
            toStatus: "Created",
            source: "initial_create",
        }

        return [...statusHistory, fallbackCreatedEntry].sort((left, right) => {
            const leftTime = toDate(left.date)?.getTime() || 0
            const rightTime = toDate(right.date)?.getTime() || 0
            return rightTime - leftTime
        })
    }, [statusHistory, project.id, project.createdAt])

    const openSitePanel = React.useCallback(() => {
        if (onOpenSite) {
            onOpenSite(project.site)
            return
        }
        router.push(sitePanelHref)
    }, [onOpenSite, project.site, router, sitePanelHref])

    const openTaskSiteFromTaskPanel = React.useCallback((siteValue: unknown) => {
        const site = siteValue as Site & { partner?: { id: string; name: string } }
        if (site?.id && site?.partner?.id) {
            if (onOpenSite) {
                onOpenSite(site)
                return
            }
            router.push(`/partners/${site.partner.id}/${site.id}`)
            return
        }

        openSitePanel()
    }, [onOpenSite, openSitePanel, router])

    return (
        <TaskSheetWrapper
            tasks={project.tasks || []}
            project={project}
            panelSize="compact"
            panelStackLevel={1}
            onOpenProject={() => undefined}
            onOpenSite={openTaskSiteFromTaskPanel}
        >
            <div className="relative flex h-full flex-col overflow-hidden bg-[var(--bg-surface)]">
                <div className="absolute right-5 top-5 z-30 flex items-center gap-2 sm:right-8 sm:top-7">
                    {!standalone && onClose && (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            aria-label="Close project"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-8">
                    <div className="mx-auto max-w-[820px] space-y-6 pb-6">
                        <div className="sticky top-0 z-20 -mx-5 border-b border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 pb-2 pt-5 sm:-mx-8 sm:px-8 sm:pt-7">
                        <div className="space-y-2 pr-16 pb-3">
                            {isEditingTitle ? (
                                <Textarea
                                    value={localName}
                                    onChange={(event) => setLocalName(event.target.value)}
                                    className="min-h-[48px] resize-none !rounded-none !border-0 !border-b !border-[var(--line-subtle)] !bg-transparent !px-0 !pb-2 !pt-0 text-2xl font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] !shadow-none focus-visible:!border-b-2 focus-visible:!border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] focus-visible:!ring-0 md:text-3xl"
                                    rows={1}
                                    autoFocus
                                    onBlur={commitTitle}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault()
                                            commitTitle()
                                        }
                                        if (event.key === "Escape") {
                                            event.stopPropagation()
                                            setLocalName(formatProjectName(project))
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
                                        <h1 className="text-xl font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] md:text-2xl">
                                            {localName || formatProjectName(project)}
                                        </h1>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsEditingTitle(true)}
                                        className="mt-0.5 h-8 w-8 shrink-0 rounded-lg text-[var(--text-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                        aria-label="Edit project title"
                                        title="Edit project title"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {updatingId === project.id && (
                                <div className="text-xs font-medium text-[var(--text-muted)]">
                                    <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                                    Updating...
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto pb-2">
                            <SidePanelTabs
                                ariaLabel="Project details"
                                value={activeTab}
                                onValueChange={handleTabChange}
                                tabs={[
                                    { value: "overview", label: "Overview" },
                                    { value: "tasks", label: "Tasks", badge: project.tasks?.length || 0 },
                                    { value: "notes", label: "Notes" },
                                    { value: "time", label: "Time" },
                                    { value: "activity", label: "Activity" },
                                ]}
                            />
                        </div>
                        </div>

                        <div
                            role="tabpanel"
                            id={`project-details-${activeTab}-panel`}
                            aria-labelledby={`project-details-${activeTab}-tab`}
                            tabIndex={0}
                            className="space-y-6 focus-visible:outline-none"
                        >

                        {activeTab === "overview" ? <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {/* 1. Status Dropdown */}
                            <div className="flex flex-col">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={updatingId === project.id}
                                            className={cn(
                                                "group/status relative flex h-11 w-full items-center justify-between gap-2 overflow-hidden rounded-[14px] border px-3.5 transition-all duration-200 active:scale-[0.98]",
                                                project.status === "Active" && "border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_10%,var(--surface-lowest))] text-[var(--brand-primary)]",
                                                project.status === "Paused" && "border-[color:color-mix(in_srgb,var(--state-warning)_35%,transparent)] bg-[var(--warning-surface)] text-[var(--warning-foreground)]",
                                                project.status === "Completed" && "border-[color:color-mix(in_srgb,var(--state-success)_35%,transparent)] bg-[var(--state-success-surface)] text-[var(--state-success)]",
                                                project.status === "Closed" && "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)]"
                                            )}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                {project.status === "Active" ? <Play className="h-3.5 w-3.5 shrink-0 fill-current" /> : null}
                                                {project.status === "Paused" ? <Pause className="h-3.5 w-3.5 shrink-0" /> : null}
                                                {project.status === "Completed" ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                                                {project.status === "Closed" ? <Square className="h-3.5 w-3.5 shrink-0 fill-current" /> : null}
                                                <span className="truncate text-xs font-bold sm:text-sm">{project.status}</span>
                                            </div>
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-44 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                        {(["Active", "Paused", "Completed", "Closed"] as const).map((statusOption) => (
                                            <DropdownMenuItem
                                                key={statusOption}
                                                onSelect={() => updateProjectStatus(statusOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold"
                                            >
                                                {statusOption === "Active"
                                                    && isRecurringProject
                                                    && (project.status === "Closed" || project.status === "Completed")
                                                    ? "Open another month…"
                                                    : statusOption}
                                                {project.status === statusOption ? <Check className="ml-auto h-4 w-4 text-[var(--brand-primary)]" /> : null}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* 2. Payment Status Dropdown */}
                            <div className="flex flex-col">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={updatingId === project.id}
                                            className={cn(
                                                "group/payment relative flex h-11 w-full items-center justify-between gap-2 overflow-hidden rounded-[14px] border px-3.5 transition-all duration-200 active:scale-[0.98]",
                                                project.paymentStatus === "Paid" 
                                                    ? "border-[color:color-mix(in_srgb,var(--state-success)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_10%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-success)_90%,var(--text-primary))]"
                                                    : "border-[color:color-mix(in_srgb,var(--state-urgent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_10%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-urgent)_90%,var(--text-primary))]"
                                            )}
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className={cn(
                                                    "h-2.5 w-2.5 shrink-0 rounded-full", 
                                                    project.paymentStatus === "Paid" ? "bg-[var(--state-success)]" : "bg-[var(--state-urgent)]"
                                                )} />
                                                <span className="truncate text-xs font-bold sm:text-sm">{project.paymentStatus}</span>
                                            </div>
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-40 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                        {(["Paid", "Unpaid"] as const).map((paymentOption) => (
                                            <DropdownMenuItem
                                                key={paymentOption}
                                                onSelect={() => updateProjectPaymentStatus(paymentOption)}
                                                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                            >
                                                <span className={cn("mr-2 h-2 w-2 rounded-full", paymentOption === "Paid" ? "bg-[var(--state-success)]" : "bg-[var(--state-urgent)]")} />
                                                {paymentOption}
                                                {project.paymentStatus === paymentOption && <Check className="ml-auto h-3.5 w-3.5 text-[var(--brand-primary)]" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* 3. Amount Input Card */}
                            <div className="flex flex-col">
                                <div className="group/amount relative flex h-11 items-center overflow-hidden rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3.5 shadow-xs transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20">
                                    <Input
                                        type="number"
                                        step={1}
                                        value={amountInput}
                                        onChange={(event) => setAmountInput(event.target.value)}
                                        onBlur={handleAmountBlur}
                                        className="relative z-10 h-auto border-none bg-transparent p-0 text-left text-sm font-bold tracking-tight text-[var(--text-primary)] shadow-none focus-visible:ring-0 sm:text-base"
                                        placeholder="0"
                                    />
                                    <span className="relative z-10 ml-2 inline-flex shrink-0 items-center rounded-md bg-[var(--surface-low)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                        RON
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isRecurringProject ? (
                            <p className="text-xs font-medium text-[var(--text-muted)]">
                                Future months use {Number(project.recurringBaseFee ?? project.currentFee ?? 0).toLocaleString("ro-RO")} RON.
                            </p>
                        ) : null}

                        {project.status === "Closed" && (
                            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 py-2">
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                    Closed on {project.closedAt ? format(new Date(project.closedAt), "dd MMM yyyy") : "—"}
                                </span>
                                <span
                                    className={cn(
                                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                        project.isHeavyRevenueMonth
                                            ? "border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))] bg-[var(--state-success-surface)] text-[var(--state-success)]"
                                            : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)]"
                                    )}
                                >
                                    {project.isHeavyRevenueMonth ? "Heavy revenue month" : "Normal revenue month"}
                                </span>
                            </div>
                        )}
                        <section className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4">
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">Tasks</p>
                                <Button type="button" variant="ghost" onClick={() => setActiveTab("tasks")} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--brand-primary)]">
                                    View all ({project.tasks?.length || 0})
                                </Button>
                            </div>
                            {activeProjectTasks.length > 0 ? (
                                <div className="mt-3 divide-y divide-[var(--line-subtle)] border-t border-[var(--line-subtle)]">
                                    {activeProjectTasks.slice(0, 3).map((task) => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            onClick={() => setActiveTab("tasks")}
                                            className="flex min-h-9 w-full items-center justify-between gap-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition hover:text-[var(--brand-primary)]"
                                        >
                                            <span className="truncate">{task.name || "Untitled task"}</span>
                                            <span className="shrink-0 text-xs text-[var(--text-muted)]">Open</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-2 text-xs text-[var(--text-muted)]">No active tasks</p>
                            )}
                        </section>
                        </> : null}

                        {activeTab === "tasks" ? <section className="space-y-3">
                            <SidePanelSectionTitle title="Project tasks" icon={<ListTodo className="h-3.5 w-3.5" />} />
                            <ProjectTasks projectId={project.id} initialTasks={project.tasks || []} />
                        </section> : null}

                        {activeTab === "notes" ? <SidePanelNotesSection
                            title="Project notes"
                            icon={<FileText className="h-3.5 w-3.5" />}
                            statusLabel={
                                notesSaveState === "idle"
                                    ? "Ready"
                                    : notesSaveState === "typing"
                                        ? "Typing"
                                        : notesSaveState === "saving"
                                            ? "Saving"
                                            : notesSaveState === "saved"
                                                ? "Saved"
                                                : "Error"
                            }
                            statusTone={
                                notesSaveState === "saving"
                                    ? "blue"
                                    : notesSaveState === "saved" || notesSaveState === "idle"
                                        ? "emerald"
                                        : notesSaveState === "typing"
                                            ? "amber"
                                            : "rose"
                            }
                            statusState={notesSaveState === "idle" ? "ready" : notesSaveState}
                            value={description}
                            onChange={handleDescriptionChange}
                            onBlur={flushDescriptionSave}
                            uploadProjectId={project.id}
                            onAddTemplate={appendRequirementsTemplate}
                            onExpand={() => setIsNotesModalOpen(true)}
                            expandLabel="Open in modal"
                            extraToolbarActions={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={exportNotesAsPdf}
                                    disabled={isExportingNotes}
                                    className="h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                    aria-label="Export notes as PDF"
                                    title="Export notes as PDF"
                                >
                                    {isExportingNotes ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileDown className="h-4 w-4" />
                                    )}
                                </Button>
                            }
                            className="border-t-0 pt-0"
                            minHeightClassName="min-h-[calc(100dvh-330px)] sm:min-h-[520px]"
                        /> : null}

                        {activeTab === "time" ? <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <SidePanelSectionTitle title="Hour Recommendation" icon={<Target className="h-3.5 w-3.5" />} />
                                {budgetInsights.hasHourlyRate && budgetInsights.hasFee && (
                                    <span
                                        className={cn(
                                            "inline-flex h-7 items-center rounded-full border px-3 text-xs font-bold uppercase tracking-[0.08em]",
                                            budgetInsights.isOverBudget
                                                ? "border-[color:color-mix(in_srgb,var(--state-urgent)_28%,var(--line-subtle))] bg-[var(--state-danger-surface)] text-[var(--state-urgent)]"
                                                : "border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))] bg-[var(--state-success-surface)] text-[var(--state-success)]"
                                        )}
                                    >
                                        {budgetInsights.isOverBudget ? "Over Budget" : "On Track"}
                                    </span>
                                )}
                            </div>

                            {!budgetInsights.hasHourlyRate ? (
                                <div className="rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Hourly Budget</p>
                                    <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                                        Set your hourly rate to enable fee based hour recommendations.
                                    </p>
                                    <Link href="/settings" className="mt-2 inline-flex text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary)]">
                                        Open Settings
                                    </Link>
                                </div>
                            ) : !budgetInsights.hasFee ? (
                                <div className="rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5">
                                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Hourly Budget</p>
                                    <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                                        Set project amount to compute recommended hours.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)]">
                                    <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-4">
                                        <div className="grid grid-cols-3 gap-1.5 lg:col-span-3 lg:gap-2">
                                            <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] bg-[var(--brand-primary)] px-2.5 py-2 sm:px-3 sm:py-2.5">
                                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--primary)] sm:text-xs">Recommended</p>
                                                <p className="mt-1 font-mono text-lg font-black tabular-nums text-[var(--primary)] sm:text-xl">
                                                    {formatHoursWithMinutes(budgetInsights.recommendedHours)}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-low)] px-2.5 py-2 sm:px-3 sm:py-2.5">
                                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)] sm:text-xs">Tracked</p>
                                                <p className="mt-1 font-mono text-lg font-black tabular-nums text-[var(--text-primary)] sm:text-xl">
                                                    {formatHoursWithMinutes(budgetInsights.trackedHoursNow)}
                                                </p>
                                            </div>

                                            <div className={cn(
                                                "rounded-2xl border px-2.5 py-2 sm:px-3 sm:py-2.5",
                                                budgetInsights.isOverBudget
                                                    ? "border-[color:color-mix(in_srgb,var(--state-urgent)_28%,var(--line-subtle))] bg-[var(--state-urgent)]"
                                                    : "border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))] bg-[var(--state-success)]"
                                            )}>
                                                <p className={cn(
                                                    "text-xs font-bold uppercase tracking-[0.08em] sm:text-xs",
                                                    budgetInsights.isOverBudget ? "text-[var(--state-urgent)]" : "text-[var(--state-success)]"
                                                )}>
                                                    {budgetInsights.isOverBudget ? "Overrun" : "Remaining"}
                                                </p>
                                                <p className={cn(
                                                    "mt-1 font-mono text-lg font-black tabular-nums sm:text-xl",
                                                    budgetInsights.isOverBudget ? "text-[var(--state-urgent)]" : "text-[var(--state-success)]"
                                                )}>
                                                    {formatHoursWithMinutes(Math.abs(budgetInsights.remainingHours))}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 py-2.5 lg:col-span-1">
                                            <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                                <span>Progress</span>
                                                <span>{budgetInsights.progressPercent.toFixed(0)}%</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-low)]">
                                                <div
                                                    className={cn(
                                                        "h-full transition-all duration-500",
                                                        budgetInsights.isOverBudget
                                                            ? "bg-[var(--state-urgent)]"
                                                            : budgetInsights.progressPercent > 80
                                                                ? "bg-[var(--state-warning)]"
                                                                : "bg-[var(--state-success)]"
                                                    )}
                                                    style={{ width: `${budgetInsights.progressBarPercent}%` }}
                                                />
                                            </div>
                                            <p className="mt-1 text-right text-xs font-medium text-[var(--text-secondary)]">
                                                {new Intl.NumberFormat("ro-RO", {
                                                    style: "currency",
                                                    currency: "RON",
                                                    maximumFractionDigits: 0,
                                                }).format(budgetInsights.feeValue)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section> : null}


                        {activeTab === "time" ? <section className="space-y-2 border-t border-[var(--line-subtle)] pt-5">
                            <div className="flex items-center justify-between">
                                <h2 className="ui-overline inline-flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Recent Time
                                </h2>
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
                                currentSessionSeconds={currentSessionSeconds}
                                isRunning={isProjectTimerRunning}
                                isPaused={isProjectTimerPaused}
                                timerStatusLabel={timerStatusLabel}
                                onPrimaryAction={handleTimerPrimaryAction}
                                onStopAction={() => void globalStopTimer()}
                                isStopDisabled={!isTimerForProject}
                            />

                            {isManualTimeOpen && (
                                <SidePanelManualTimeForm
                                    minutes={manualMinutes}
                                    notes={manualNotes}
                                    onMinutesChange={setManualMinutes}
                                    onNotesChange={setManualNotes}
                                    onSave={handleManualLog}
                                    isSaving={isLoggingTime}
                                />
                            )}

                            <SidePanelTimeLogHistoryList
                                logs={recentLogs.map((log) => ({
                                    id: log.id,
                                    startTime: log.startTime,
                                    endTime: log.endTime,
                                    durationSeconds: log.durationSeconds,
                                    taskName: log.task?.name || undefined,
                                }))}
                                emptyMessage="No time logged for this project yet."
                                className="space-y-1.5"
                                emptyClassName="py-8 text-sm"
                                onSelectLog={(log) => {
                                    const selected = recentLogs.find((entry) => entry.id === log.id)
                                    if (!selected) return
                                    setSelectedTimeLog(selected as ProjectTimeLogWithTask)
                                    setIsTimeLogSheetOpen(true)
                                }}
                            />
                        </section> : null}

                        {activeTab === "overview" ? (
                            <>
                                <ProjectSheetInfoSection
                                    partnerName={project.site.partner.name}
                                    domainName={project.site.domainName}
                                    onOpenPartner={() => {
                                        if (onOpenPartner) onOpenPartner(project.site.partner.id)
                                        else router.push(`/partners/${project.site.partner.id}`)
                                    }}
                                    onOpenSitePanel={openSitePanel}
                                    externalSiteUrl={externalSiteUrl}
                                    services={(project.services || []).map((service) => ({
                                        id: service.id,
                                        serviceName: service.serviceName,
                                    }))}
                                    isEditingServices={false}
                                    onToggleService={toggleService}
                                    recurringServices={recurringServices.map((service) => ({
                                        id: service.id,
                                        serviceName: service.serviceName,
                                    }))}
                                    oneTimeServices={oneTimeServices.map((service) => ({
                                        id: service.id,
                                        serviceName: service.serviceName,
                                    }))}
                                />
                                <div className="flex items-center justify-center pt-4 pb-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete()}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--state-urgent)] opacity-70 transition hover:opacity-100 hover:underline"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete project
                                    </button>
                                </div>
                            </>
                        ) : null}

                        {activeTab === "activity" ? <ProjectHistoryLogSections
                            paymentHistory={paymentHistory}
                            isLoadingHistory={isLoadingHistory}
                            statusHistoryEntries={statusHistoryEntries}
                            isLoadingStatusHistory={isLoadingStatusHistory}
                        /> : null}


                        {activeTab === "activity" ? <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4">
                            <SidePanelDetailRow label="Project ID" value={project.id.split("-")[0]} />
                            <SidePanelDetailRow label="Created" value={
                                isEditingCreatedAt ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Input
                                            type="datetime-local"
                                            value={createdAtInput}
                                            onChange={(e) => setCreatedAtInput(e.target.value)}
                                            className="h-7 w-[210px] border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 py-1 text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreatedAtSave}
                                            className="text-[var(--primary)] hover:text-[var(--primary)]"
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreatedAtInput(toDateTimeLocalValue(toDate(project.createdAt)))
                                                setIsEditingCreatedAt(false)
                                            }}
                                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        >
                                            Cancel
                                        </button>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>{formatBottomDate(toDate(project.createdAt))}</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingCreatedAt(true)}
                                            className="text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                                            aria-label="Edit created date"
                                            title="Edit created date"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                )
                            } />
                            <SidePanelDetailRow label="Updated" value={lastUpdatedTimestamp ? formatBottomDate(lastUpdatedTimestamp) : "—"} />
                        </div> : null}
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
                    panelStackLevel={1}
                />

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
                                        Project Notes - {formatProjectName(project)}
                                    </DialogTitle>
                                    <span className="mt-2 inline-flex min-w-[140px] items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                                        {notesSaveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />}
                                        {notesSaveState === "saved" && <CheckCircle className="h-3.5 w-3.5 text-[var(--state-success)]" />}
                                        {notesSaveState === "error" && <AlertCircle className="h-3.5 w-3.5 text-[var(--state-urgent)]" />}
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
                                            className="h-11 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 text-sm font-semibold text-[var(--text-secondary)] shadow-sm hover:bg-[var(--surface-low)]"
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Close
                                        </Button>
                                    </DialogClose>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex h-[calc(92vh-81px)] flex-col overflow-hidden bg-background px-8 pb-8 pt-6">
                            <RichTextEditor
                                value={description}
                                onChange={handleDescriptionChange}
                                onBlur={flushDescriptionSave}
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
                                            className="h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
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
                                            className="h-8 w-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
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

                <CloseProjectDialog
                    open={isCloseProjectDialogOpen}
                    onOpenChange={setIsCloseProjectDialogOpen}
                    onConfirm={handleCloseProjectConfirm}
                    projectName={localName || formatProjectName(project)}
                    isSubmitting={isSubmittingCloseProject}
                    initialClosedOn={toDateInputValue(project.closedAt)}
                    initialIsHeavyRevenueMonth={Boolean(project.isHeavyRevenueMonth)}
                />

                <Dialog open={isReopenRecurringDialogOpen} onOpenChange={(open) => {
                    if (!isReopeningRecurring) setIsReopenRecurringDialogOpen(open)
                }}>
                    <DialogContent className="overflow-hidden gap-0 p-0 sm:max-w-[520px]">
                        <DialogHeader className="border-b border-[var(--line-subtle)] px-5 py-5 pr-16 text-left sm:px-6 sm:py-6 sm:pr-16">
                            <div className="flex items-start gap-3.5">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-[color:color-mix(in_srgb,var(--brand-primary)_24%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-primary)_11%,var(--surface-lowest))] text-[var(--brand-primary)]">
                                    <CalendarRange className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 pt-0.5">
                                    <DialogTitle className="text-xl tracking-[-0.02em]">Open recurring project</DialogTitle>
                                    <DialogDescription className="mt-2 leading-5 text-[var(--text-secondary)]">
                                        <span className="font-semibold text-[var(--text-primary)]">
                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                        </span>{" "}
                                        stays unchanged. Select the next month you want to work on.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="px-4 py-4 sm:px-6 sm:py-5">
                            <RecurringProjectMonthPicker
                                value={reopenMonth}
                                minimumMonth={minimumReopenMonth}
                                onChange={setReopenMonth}
                                disabled={isReopeningRecurring}
                            />
                        </div>

                        <DialogFooter className="border-t border-[var(--line-subtle)] bg-[var(--surface-low)] px-4 py-4 sm:px-6">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsReopenRecurringDialogOpen(false)}
                                disabled={isReopeningRecurring}
                                className="h-11 rounded-xl sm:min-w-24"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void handleReopenRecurring()}
                                disabled={isReopeningRecurring || !reopenMonth}
                                className="h-11 rounded-xl sm:min-w-44"
                            >
                                {isReopeningRecurring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Open {reopenMonthLabel}
                                {!isReopeningRecurring ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TaskSheetWrapper>
    )
}
