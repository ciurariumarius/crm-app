"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    ArrowDown,
    ArrowUpRight,
    Calendar,
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    FolderOpen,
    Globe,
    Layers,
    Loader2,
    Pause,
    Play,
    Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import { setTaskTimeTotal } from "@/lib/actions/time"
import {
    formatTaskTrackedSeconds,
    parseFlexibleMinutes,
} from "@/lib/tasks/tracked-time"
import { SidePanelDetailRow } from "@/components/ui/side-panel-primitives"
import { LmsIcon } from "@/components/lms/lms-icon"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns"

const PRESET_TIME_MINUTES = [
    { minutes: 30, label: "30m", subLabel: "0.5h" },
    { minutes: 60, label: "60m", subLabel: "1h" },
    { minutes: 90, label: "90m", subLabel: "1.5h" },
    { minutes: 120, label: "120m", subLabel: "2h" },
    { minutes: 180, label: "180m", subLabel: "3h" },
    { minutes: 240, label: "240m", subLabel: "4h" },
] as const

type TaskSheetInfoSectionProps = {
    taskId: string
    taskName: string
    taskScope: "FREELANCE" | "LMS" | "GENERAL" | string
    status?: string | null
    onStatusChange?: (status: "Active" | "Pending" | "Done") => void
    loading?: boolean
    pendingTaskId?: string | null
    partnerName?: string | null
    partnerId?: string | null
    projectName?: string | null
    domainName?: string | null
    externalSiteUrl?: string | null
    lmsClientName?: string | null
    lmsAllocationId?: string | null
    lmsAllocations?: Array<{ id: string; client: string }>
    onSelectLmsAllocation?: (allocationId: string, clientName: string) => void
    lmsTaskTypeName?: string | null
    lmsTaskTypeId?: string | null
    lmsWorkTasks?: Array<{ id: string; name: string }>
    onSelectLmsTaskType?: (taskTypeId: string, taskTypeName: string) => void
    urgency: string
    onUrgencyChange: (urgency: "High" | "Medium" | "Low") => void
    isUpdatingUrgency?: boolean
    deadline?: Date | string | null
    createdAt?: Date | string | null
    updatedAt?: Date | string | null
    estimatedMinutes?: number | null
    trackedSeconds: number
    isActionsBlocked?: boolean
    onTrackedTimeSaved?: (newSeconds: number) => void
    onOpenPartner?: () => void
    onOpenProject?: () => void
    onOpenSite?: () => void
    onEditDetails?: () => void
    onDeleteTask?: () => void
}

function getPriorityPill(urgency: string | null | undefined) {
    const priority = normalizeTaskUrgency(urgency)
    if (priority === "High") {
        return {
            label: "High",
            className: "border border-rose-200/80 bg-rose-50/90 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400",
            icon: <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    if (priority === "Low") {
        return {
            label: "Low",
            className: "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
            icon: <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    return {
        label: "Medium",
        className: "border border-amber-200/80 bg-amber-50/90 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
        icon: <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />,
    }
}

function formatDeadlinePill(deadline: Date | string | null | undefined) {
    if (!deadline) return null
    const date = new Date(deadline)
    if (Number.isNaN(date.getTime())) return null

    const formattedDate = format(date, "d MMM yyyy")
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)

    if (isToday(target)) {
        return {
            label: `Today (${formattedDate})`,
            tone: "amber",
        }
    }
    if (isTomorrow(target)) {
        return {
            label: `Tomorrow (${formattedDate})`,
            tone: "blue",
        }
    }
    if (isPast(target)) {
        const days = Math.abs(differenceInDays(now, target))
        return {
            label: `Overdue by ${days}d (${formattedDate})`,
            tone: "rose",
        }
    }
    const days = differenceInDays(target, now)
    return {
        label: `In ${days} days (${formattedDate})`,
        tone: "neutral",
    }
}

function TaskTimeInputCard({
    taskId,
    trackedSeconds,
    disabled,
    onSaved,
}: {
    taskId: string
    trackedSeconds: number
    disabled?: boolean
    onSaved?: (newSeconds: number) => void
}) {
    const router = useRouter()
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const currentMinutes = Math.max(0, Math.round(trackedSeconds / 60))
    const [inputValue, setInputValue] = React.useState(String(currentMinutes))
    const [isFocused, setIsFocused] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isSuggestionsOpen, setIsSuggestionsOpen] = React.useState(false)

    React.useEffect(() => {
        if (!isFocused) {
            const nextMinutes = Math.max(0, Math.round(trackedSeconds / 60))
            setInputValue(String(nextMinutes))
        }
    }, [trackedSeconds, isFocused])

    React.useEffect(() => {
        if (!isSuggestionsOpen) return
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsSuggestionsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("touchstart", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("touchstart", handleClickOutside)
        }
    }, [isSuggestionsOpen])

    const saveMinutes = async (targetMinutes: number) => {
        if (targetMinutes === currentMinutes) return

        setIsSaving(true)
        try {
            const result = await setTaskTimeTotal({ taskId, totalMinutes: targetMinutes })
            if (!result.success) {
                toast.error(result.error || "Failed to update time")
                setInputValue(String(currentMinutes))
                return
            }
            onSaved?.(targetMinutes * 60)
            setInputValue(String(targetMinutes))
            toast.success(`Tracked time updated to ${formatTaskTrackedSeconds(targetMinutes * 60)}`)
            router.refresh()
        } catch {
            toast.error("Failed to update time")
            setInputValue(String(currentMinutes))
        } finally {
            setIsSaving(false)
        }
    }

    const handleCommit = async () => {
        const parsed = parseFlexibleMinutes(inputValue)
        if (parsed === undefined) {
            setInputValue(String(currentMinutes))
            toast.error("Please enter a valid duration (e.g. 45 or 1h 30m)")
            return
        }
        await saveMinutes(parsed)
    }

    const handleSelectPreset = async (presetMinutes: number) => {
        setIsSuggestionsOpen(false)
        setInputValue(String(presetMinutes))
        await saveMinutes(presetMinutes)
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="group/time relative flex h-11 items-center overflow-hidden rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3.5 shadow-xs transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20">
                <Clock className="mr-2 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-focus-within/time:text-[var(--brand-primary)]" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => {
                        setIsFocused(true)
                        setIsSuggestionsOpen(true)
                        e.target.select()
                    }}
                    onBlur={(e) => {
                        setIsFocused(false)
                        if (containerRef.current?.contains(e.relatedTarget as Node)) {
                            return
                        }
                        void handleCommit()
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            setIsSuggestionsOpen(false)
                            e.currentTarget.blur()
                        }
                        if (e.key === "Escape") {
                            setIsSuggestionsOpen(false)
                        }
                    }}
                    disabled={disabled}
                    placeholder="0"
                    className="relative z-10 w-full min-w-0 border-none bg-transparent p-0 text-left text-xs font-bold tracking-tight text-[var(--text-primary)] shadow-none outline-none focus:outline-none focus:ring-0 sm:text-sm placeholder:text-[var(--text-muted)]"
                    aria-label="Tracked time in minutes"
                />
                <div className="relative z-10 ml-2 flex shrink-0 items-center gap-1.5">
                    {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-primary)] shrink-0" />
                    ) : null}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault()
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsSuggestionsOpen((prev) => {
                                const next = !prev
                                if (next) {
                                    inputRef.current?.focus()
                                }
                                return next
                            })
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--surface-low)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer transition-colors"
                        title="Quick time suggestions (30, 60, 90, 120 min)"
                    >
                        <span>MIN</span>
                        <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform duration-200", isSuggestionsOpen && "rotate-180")} />
                    </button>
                </div>
            </div>

            {isSuggestionsOpen ? (
                <div
                    className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-[260px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2.5 shadow-[0_12px_32px_rgba(23,26,24,0.12)]"
                    onMouseDown={(e) => {
                        e.preventDefault()
                    }}
                >
                    <div className="flex items-center justify-between border-b border-[var(--line-subtle)] pb-1.5 px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Suggestions</span>
                        <span className="text-xs text-[var(--text-muted)]">30, 60, 90, 120 min</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Predefined time suggestions">
                        {PRESET_TIME_MINUTES.map((preset) => {
                            const isSelected = currentMinutes === preset.minutes
                            return (
                                <button
                                    key={preset.minutes}
                                    type="button"
                                    onClick={() => void handleSelectPreset(preset.minutes)}
                                    className={cn(
                                        "flex flex-col items-center justify-center rounded-xl border py-1.5 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer",
                                        isSelected
                                            ? "border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,var(--surface-lowest))] text-[var(--brand-primary)]"
                                            : "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-primary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] hover:bg-[var(--surface-sunken)]"
                                    )}
                                >
                                    <span>{preset.label}</span>
                                    <span className="text-xs font-medium text-[var(--text-muted)]">{preset.subLabel}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export function TaskSheetInfoSection({
    taskId,
    taskName,
    taskScope,
    status = "Active",
    onStatusChange,
    loading = false,
    pendingTaskId,
    partnerName,
    projectName,
    domainName,
    externalSiteUrl,
    lmsClientName,
    lmsAllocationId,
    lmsAllocations,
    onSelectLmsAllocation,
    lmsTaskTypeName,
    lmsTaskTypeId,
    lmsWorkTasks,
    onSelectLmsTaskType,
    urgency,
    onUrgencyChange,
    isUpdatingUrgency,
    deadline,
    createdAt,
    estimatedMinutes,
    trackedSeconds,
    isActionsBlocked,
    onTrackedTimeSaved,
    onOpenPartner,
    onOpenProject,
    onOpenSite,
    onEditDetails,
    onDeleteTask,
}: TaskSheetInfoSectionProps) {
    const priorityPill = getPriorityPill(urgency)
    const deadlineInfo = formatDeadlinePill(deadline)
    const createdDate = createdAt ? new Date(createdAt) : null
    const formattedCreated = createdDate && !Number.isNaN(createdDate.getTime())
        ? format(createdDate, "d MMMM yyyy, HH:mm")
        : null

    const showFreelanceCards = taskScope === "FREELANCE" || (!taskScope && (projectName || domainName || partnerName))
    const showLmsCard = taskScope === "LMS"

    const isPending = status === "Pending" || status === "Paused"
    const isDone = status === "Completed" || status === "Done"
    const isActive = !isPending && !isDone

    return (
        <section className="space-y-4">
            {/* Top 3-Pill Controls Row: Status, Priority, Time on the same line */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* 1. Status Dropdown */}
                <div className="flex flex-col">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={loading || pendingTaskId === taskId || !onStatusChange}
                                className={cn(
                                    "group/status relative flex h-11 w-full items-center justify-between gap-2 overflow-hidden rounded-[14px] border px-3.5 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                                    isActive && "border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_10%,var(--surface-lowest))] text-[var(--brand-primary)]",
                                    isPending && "border-[color:color-mix(in_srgb,var(--state-warning)_35%,transparent)] bg-[var(--warning-surface)] text-[var(--warning-foreground)]",
                                    isDone && "border-[color:color-mix(in_srgb,var(--state-success)_35%,transparent)] bg-[var(--state-success-surface)] text-[var(--state-success)]"
                                )}
                                aria-label="Task Status"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    {isActive ? <Play className="h-3.5 w-3.5 shrink-0 fill-current" /> : null}
                                    {isPending ? <Pause className="h-3.5 w-3.5 shrink-0 fill-current" /> : null}
                                    {isDone ? <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" /> : null}
                                    <span className="truncate text-xs font-bold sm:text-sm">
                                        {isDone ? "Done" : isPending ? "Pending" : "Active"}
                                    </span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            {([
                                { label: "Active", value: "Active" as const },
                                { label: "Pending", value: "Pending" as const },
                                { label: "Done", value: "Done" as const },
                            ]).map((statusOption) => {
                                const isCurrent = (statusOption.value === "Done" && isDone)
                                    || (statusOption.value === "Pending" && isPending)
                                    || (statusOption.value === "Active" && isActive)
                                return (
                                    <DropdownMenuItem
                                        key={statusOption.value}
                                        onSelect={() => void onStatusChange?.(statusOption.value)}
                                        className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold"
                                    >
                                        <span className="flex items-center gap-2">
                                            {statusOption.value === "Active" ? <Play className="h-3.5 w-3.5 fill-current text-[var(--primary)]" /> :
                                             statusOption.value === "Pending" ? <Pause className="h-3.5 w-3.5 fill-current text-[var(--state-warning)]" /> :
                                             <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />}
                                            {statusOption.label}
                                        </span>
                                        {isCurrent ? <Check className="ml-auto h-4 w-4 text-[var(--brand-primary)]" /> : null}
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 2. Priority Dropdown */}
                <div className="flex flex-col">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={isUpdatingUrgency || isActionsBlocked}
                                className={cn(
                                    "group/priority relative flex h-11 w-full items-center justify-between gap-2 overflow-hidden rounded-[14px] border px-3.5 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                                    priorityPill.label === "High" && "border-[color:color-mix(in_srgb,var(--state-urgent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_10%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-urgent)_90%,var(--text-primary))]",
                                    priorityPill.label === "Medium" && "border-[color:color-mix(in_srgb,var(--state-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_10%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-warning)_90%,var(--text-primary))]",
                                    priorityPill.label === "Low" && "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)]"
                                )}
                                aria-label="Task Priority"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={cn(
                                        "h-2.5 w-2.5 shrink-0 rounded-full",
                                        priorityPill.label === "High" && "bg-[var(--state-urgent)]",
                                        priorityPill.label === "Medium" && "bg-amber-500",
                                        priorityPill.label === "Low" && "bg-zinc-400"
                                    )} />
                                    <span className="truncate text-xs font-bold sm:text-sm">{priorityPill.label} Priority</span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            {(["High", "Medium", "Low"] as const).map((priorityOption) => (
                                <DropdownMenuItem
                                    key={priorityOption}
                                    onSelect={() => onUrgencyChange(priorityOption)}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className={cn(
                                            "h-2 w-2 rounded-full",
                                            priorityOption === "High" && "bg-[var(--state-urgent)]",
                                            priorityOption === "Medium" && "bg-amber-500",
                                            priorityOption === "Low" && "bg-zinc-400"
                                        )} />
                                        {priorityOption}
                                    </span>
                                    {normalizeTaskUrgency(urgency) === priorityOption && <Check className="ml-auto h-3.5 w-3.5 text-[var(--brand-primary)]" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 3. Time Direct Input Card */}
                <div className="flex flex-col">
                    <TaskTimeInputCard
                        taskId={taskId}
                        trackedSeconds={trackedSeconds}
                        disabled={isActionsBlocked}
                        onSaved={onTrackedTimeSaved}
                    />
                </div>
            </div>

            {/* Quick-jump Context Cards for Freelance */}
            {showFreelanceCards && (partnerName || domainName || projectName) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {partnerName ? (
                        <button
                            type="button"
                            onClick={onOpenPartner}
                            disabled={!onOpenPartner}
                            className={cn(
                                "group flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 text-left shadow-xs transition-all duration-200",
                                onOpenPartner ? "hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] cursor-pointer" : "cursor-default"
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Partner</span>
                                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{partnerName}</p>
                            </div>
                            <FolderOpen className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--text-primary)]" />
                        </button>
                    ) : null}

                    {domainName || projectName ? (
                        <div className="flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-xs">
                            <div className="min-w-0 flex-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">
                                    {domainName ? "Domain" : "Project"}
                                </span>
                                <button
                                    type="button"
                                    onClick={onOpenProject || onOpenSite}
                                    disabled={!onOpenProject && !onOpenSite}
                                    className={cn(
                                        "block truncate text-left text-sm font-bold text-[var(--text-primary)] transition",
                                        (onOpenProject || onOpenSite) ? "hover:text-[var(--brand-primary)] cursor-pointer" : "cursor-default"
                                    )}
                                    title={domainName ? "Open site panel" : "Open project panel"}
                                >
                                    {domainName || projectName}
                                </button>
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-1.5">
                                {externalSiteUrl ? (
                                    <a
                                        href={externalSiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)]"
                                        title="Open website in new tab"
                                    >
                                        <span>Visit</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                ) : onOpenSite ? (
                                    <button
                                        type="button"
                                        onClick={onOpenSite}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        title="Open site panel"
                                    >
                                        <Globe className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* LMS Context Cards (2 columns, separated just like Partner & Domain, with reselect option) */}
            {showLmsCard ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Card 1: LMS Client */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={isActionsBlocked}
                                className="group flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 text-left shadow-xs transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] active:scale-[0.99] cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,var(--surface-lowest))] text-[var(--brand-primary)]">
                                        <LmsIcon className="h-4.5 w-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs font-medium text-[var(--text-muted)]">LMS Client</span>
                                        <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                                            {lmsClientName || "Select Client"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition group-hover:opacity-100" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                Select LMS Client
                            </div>
                            {lmsAllocations && lmsAllocations.length > 0 ? (
                                lmsAllocations.map((alloc) => {
                                    const isCurrent = alloc.id === lmsAllocationId || alloc.client === lmsClientName
                                    return (
                                        <DropdownMenuItem
                                            key={alloc.id}
                                            onSelect={() => onSelectLmsAllocation?.(alloc.id, alloc.client)}
                                            className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold"
                                        >
                                            <span className="truncate flex-1">{alloc.client}</span>
                                            {isCurrent && <Check className="ml-auto h-4 w-4 text-[var(--brand-primary)] shrink-0" />}
                                        </DropdownMenuItem>
                                    )
                                })
                            ) : (
                                <div className="px-2.5 py-2 text-xs text-[var(--text-muted)]">No LMS allocations found</div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Card 2: LMS Task Type */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                disabled={isActionsBlocked}
                                className="group flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 text-left shadow-xs transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)] active:scale-[0.99] cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--text-secondary)]">
                                        <Layers className="h-4.5 w-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs font-medium text-[var(--text-muted)]">Task Type</span>
                                        <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                                            {lmsTaskTypeName || "Select Task Type"}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition group-hover:opacity-100" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                Select Task Type
                            </div>
                            {lmsWorkTasks && lmsWorkTasks.length > 0 ? (
                                lmsWorkTasks.map((taskType) => {
                                    const isCurrent = taskType.id === lmsTaskTypeId || taskType.name === lmsTaskTypeName
                                    return (
                                        <DropdownMenuItem
                                            key={taskType.id}
                                            onSelect={() => onSelectLmsTaskType?.(taskType.id, taskType.name)}
                                            className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-semibold"
                                        >
                                            <span className="truncate flex-1">{taskType.name}</span>
                                            {isCurrent && <Check className="ml-auto h-4 w-4 text-[var(--brand-primary)] shrink-0" />}
                                        </DropdownMenuItem>
                                    )
                                })
                            ) : (
                                <div className="px-2.5 py-2 text-xs text-[var(--text-muted)]">No Task Types found</div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ) : null}

            {/* Metadata Group */}
            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 shadow-[var(--shadow-apple)]">
                {/* Target Scope */}
                <SidePanelDetailRow
                    label="Target"
                    value={
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                                taskScope === "LMS"
                                    ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]"
                                    : taskScope === "FREELANCE"
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            )}>
                                {taskScope === "LMS" ? <LmsIcon className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
                                <span>{taskScope === "LMS" ? "LMS" : taskScope === "FREELANCE" ? "Freelance" : "Personal"}</span>
                            </span>
                            {onEditDetails ? (
                                <button
                                    type="button"
                                    onClick={onEditDetails}
                                    className="text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer ml-1"
                                >
                                    Change
                                </button>
                            ) : null}
                        </div>
                    }
                />

                {/* Deadline */}
                {deadlineInfo ? (
                    <SidePanelDetailRow
                        label="Deadline"
                        value={
                            <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                deadlineInfo.tone === "rose" && "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80",
                                deadlineInfo.tone === "amber" && "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80",
                                deadlineInfo.tone === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/80",
                                deadlineInfo.tone === "neutral" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            )}>
                                <Calendar className="h-3.5 w-3.5 opacity-70" />
                                <span>{deadlineInfo.label}</span>
                            </span>
                        }
                    />
                ) : null}

                {/* Created Date */}
                {formattedCreated ? (
                    <SidePanelDetailRow
                        label="Created"
                        value={<span className="text-xs font-medium text-[var(--text-secondary)]">{formattedCreated}</span>}
                    />
                ) : null}
            </div>

            {/* Delete Task Button at bottom of overview (matching project panel) */}
            {onDeleteTask ? (
                <div className="pt-2 flex justify-center">
                    <button
                        type="button"
                        onClick={onDeleteTask}
                        disabled={isActionsBlocked}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--state-urgent)] opacity-80 transition hover:opacity-100 hover:underline cursor-pointer disabled:opacity-40"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete task
                    </button>
                </div>
            ) : null}
        </section>
    )
}
