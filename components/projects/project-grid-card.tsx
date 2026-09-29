"use client"

import * as React from "react"
import { format } from "date-fns"
import {
    Check,
    CheckCircle2,
    CircleDot,
    Clock,
    Pause,
    RefreshCcw,
    XCircle,
    Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DomainFavicon } from "@/components/domains/domain-favicon"

export const PROJECT_CARD_SHELL_CLASS =
    "relative flex min-h-[185px] w-full overflow-hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--line-subtle)_90%,transparent)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] transition-all duration-200 sm:min-h-[200px] xl:min-h-[210px]"

const currencyFormatter = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

export type ProjectCardItem = {
    id: string
    name?: string | null
    status: string
    paymentStatus: string
    amount: number
    recurringBaseFee?: number | null
    secondsLogged: number
    completedTasks: number
    createdAt: string | Date
    updatedAt: string | Date
    closedAt?: string | Date | null
    isHeavyRevenueMonth?: boolean
    isRecurring: boolean
    serviceLabel: string
    site: {
        id: string
        domainName: string
        faviconHash?: string | null
        partner?: {
            name: string
        } | null
    }
    _count?: {
        tasks?: number
    }
    tasks?: unknown[]
}

interface ProjectGridCardProps {
    project: ProjectCardItem
    onOpen: (projectId: string) => void
    onStatusChange?: (
        project: ProjectCardItem,
        nextStatus: "Active" | "Paused" | "Completed" | "Closed"
    ) => Promise<unknown> | unknown
    onPaymentChange?: (
        project: ProjectCardItem,
        nextPayment: "Paid" | "Unpaid"
    ) => Promise<unknown> | unknown
    isUpdatingStatus?: boolean
    displayStatus?: string
    displayPayment?: string
    displayAmount?: number
    className?: string
}

function getProjectStatusPill(status: string | null | undefined) {
    const norm = normalizeProjectStatus(status)
    if (norm === "Completed") {
        return {
            label: "Completed",
            className:
                "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
            icon: <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    if (norm === "Paused") {
        return {
            label: "Paused",
            className:
                "border border-amber-200/80 bg-amber-50/90 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
            icon: <Pause className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    if (norm === "Closed") {
        return {
            label: "Closed",
            className:
                "border border-zinc-200/80 bg-zinc-100/90 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400",
            icon: <XCircle className="h-3.5 w-3.5 stroke-[2.5]" />,
        }
    }
    return {
        label: "Active",
        className:
            "border border-blue-200/80 bg-blue-50/90 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400",
        icon: <CircleDot className="h-3.5 w-3.5 stroke-[2.5]" />,
    }
}

function getProjectPaymentPill(payment: string | null | undefined) {
    const isPaid = payment === "Paid"
    if (isPaid) {
        return {
            label: "Paid",
            className:
                "border border-emerald-200/80 bg-emerald-50/90 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400",
            icon: <Check className="h-3 w-3 stroke-[2.5]" />,
        }
    }
    return {
        label: "Unpaid",
        className:
            "border border-amber-200/80 bg-amber-50/90 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400",
        icon: <Clock className="h-3 w-3 stroke-[2.5]" />,
    }
}

function formatDuration(totalSeconds: number) {
    if (totalSeconds <= 0) return ""
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
}

function formatCompactAgo(date: Date | string | null | undefined): string {
    if (!date) return ""
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return ""
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - d.getTime())
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return "just now"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 4) return `${diffWeeks}w ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
}

export function ProjectGridCard({
    project,
    onOpen,
    onStatusChange,
    onPaymentChange,
    isUpdatingStatus = false,
    displayStatus,
    displayPayment,
    displayAmount,
    className,
}: ProjectGridCardProps) {
    const currentStatus = displayStatus || project.status
    const currentPayment = displayPayment || project.paymentStatus
    const amount = displayAmount ?? project.amount ?? 0

    const statusPill = getProjectStatusPill(currentStatus)
    const paymentPill = getProjectPaymentPill(currentPayment)

    const isCompleted = normalizeProjectStatus(currentStatus) === "Completed"
    const isClosed = normalizeProjectStatus(currentStatus) === "Closed"
    const isPaused = normalizeProjectStatus(currentStatus) === "Paused"

    const domainTitle = project.site?.domainName || project.name || "Untitled project"
    const serviceLabel = project.serviceLabel?.trim() || project.name || "General"

    // Subtitle displays primary service clearly under the domain
    const subtitle = serviceLabel

    const recurringMonthLabel = React.useMemo(() => {
        if (!project.isRecurring) return null
        const createdAt = new Date(project.createdAt)
        if (Number.isNaN(createdAt.getTime())) return null
        return format(createdAt, "MMM yyyy")
    }, [project.isRecurring, project.createdAt])

    const loggedDuration = formatDuration(project.secondsLogged || 0)
    const compactAgo = formatCompactAgo(project.createdAt)

    return (
        <article
            data-project-card-id={project.id}
            className={cn(
                PROJECT_CARD_SHELL_CLASS,
                "group cursor-pointer flex-col justify-between p-4 outline-none hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_65%,var(--text-muted)_35%)] hover:shadow-[var(--shadow-apple)] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 sm:p-5",
                isCompleted && "bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,var(--surface-low)_8%)]",
                isClosed && "opacity-75 bg-[color:color-mix(in_srgb,var(--surface-lowest)_85%,var(--surface-low)_15%)]",
                isPaused && "border-amber-500/20 bg-amber-500/5",
                className
            )}
            onClick={() => onOpen(project.id)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(project.id)
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open project: ${domainTitle}`}
        >
            <div>
                {/* TOP ROW: Favicon + Scope Pill on Left, Payment & Status Pills on Right */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <span
                        className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,transparent)] px-2 text-xs font-semibold text-[var(--text-secondary)]"
                        title={project.isRecurring ? "Recurring Project" : "One-time Project"}
                        aria-label={project.isRecurring ? "Recurring" : "One-time"}
                    >
                        <DomainFavicon
                            siteId={project.site?.id}
                            domain={project.site?.domainName}
                            faviconHash={project.site?.faviconHash}
                            className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
                        />
                        {project.isRecurring ? (
                            <RefreshCcw className="h-3 w-3 shrink-0 stroke-[2.2] text-[var(--brand-primary)]" />
                        ) : (
                            <Zap className="h-3 w-3 shrink-0 stroke-[2.2] text-amber-500" />
                        )}
                    </span>

                    <div
                        className="flex shrink-0 items-center gap-1 sm:gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* Payment Pill */}
                        {onPaymentChange ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-all cursor-pointer hover:opacity-80 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]",
                                            paymentPill.className
                                        )}
                                        title={`Payment: ${paymentPill.label}. Click to change`}
                                        aria-label={`Change payment status, currently ${paymentPill.label}`}
                                    >
                                        {paymentPill.icon}
                                        <span>{paymentPill.label}</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-36 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl"
                                >
                                    <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                        Payment
                                    </div>
                                    {(["Paid", "Unpaid"] as const).map((payOption) => {
                                        const isCurrent = currentPayment === payOption
                                        const pillInfo = getProjectPaymentPill(payOption)
                                        return (
                                            <DropdownMenuItem
                                                key={payOption}
                                                onSelect={(event) => {
                                                    event.stopPropagation()
                                                    void onPaymentChange(project, payOption)
                                                }}
                                                className="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                                                        pillInfo.className
                                                    )}
                                                >
                                                    {pillInfo.icon}
                                                    <span>{payOption}</span>
                                                </span>
                                                {isCurrent ? (
                                                    <Check className="ml-auto h-3.5 w-3.5 text-[var(--brand-primary)]" />
                                                ) : null}
                                            </DropdownMenuItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <span
                                className={cn(
                                    "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold",
                                    paymentPill.className
                                )}
                            >
                                {paymentPill.icon}
                                <span>{paymentPill.label}</span>
                            </span>
                        )}

                        {/* Status Pill Dropdown */}
                        {onStatusChange ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        disabled={isUpdatingStatus}
                                        className={cn(
                                            "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-all cursor-pointer hover:opacity-80 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] disabled:opacity-50",
                                            statusPill.className
                                        )}
                                        title={`Status: ${statusPill.label}. Click to change`}
                                        aria-label={`Change project status, currently ${statusPill.label}`}
                                    >
                                        {statusPill.icon}
                                        <span>{statusPill.label}</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-40 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl"
                                >
                                    <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                        Status
                                    </div>
                                    {(["Active", "Paused", "Completed", "Closed"] as const).map(
                                        (statusOption) => {
                                            const isCurrent =
                                                normalizeProjectStatus(currentStatus) === statusOption
                                            const pillInfo = getProjectStatusPill(statusOption)
                                            return (
                                                <DropdownMenuItem
                                                    key={statusOption}
                                                    onSelect={(event) => {
                                                        event.stopPropagation()
                                                        void onStatusChange(project, statusOption)
                                                    }}
                                                    className="cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                                                >
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                                                            pillInfo.className
                                                        )}
                                                    >
                                                        {pillInfo.icon}
                                                        <span>{statusOption}</span>
                                                    </span>
                                                    {isCurrent ? (
                                                        <Check className="ml-auto h-3.5 w-3.5 text-[var(--brand-primary)]" />
                                                    ) : null}
                                                </DropdownMenuItem>
                                            )
                                        }
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <span
                                className={cn(
                                    "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-bold",
                                    statusPill.className
                                )}
                            >
                                {statusPill.icon}
                                <span>{statusPill.label}</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* MIDDLE SECTION: Domain Title & Service Subtitle (Full width, wrapping cleanly without premature truncation) */}
                <div className="mt-3.5 min-w-0">
                    <h3
                        className={cn(
                            "line-clamp-2 text-[17px] sm:text-[18px] font-bold leading-snug tracking-[-0.015em] text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)] break-words",
                            isClosed && "text-[var(--text-secondary)]",
                            isCompleted && "line-through opacity-65"
                        )}
                    >
                        {domainTitle}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] sm:text-[14px] font-medium text-[var(--text-secondary)] leading-normal break-words">
                        {subtitle}
                    </p>
                </div>
            </div>

            {/* CARD FOOTER: Divider, Amount & Period/Time Bottom Row */}
            <div className="mt-auto pt-3">
                <div className="border-t border-[var(--line-subtle)] pt-3 flex min-w-0 items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                        <span className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                            {currencyFormatter.format(amount)}
                            <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">
                                RON{project.isRecurring ? " / mo" : ""}
                            </span>
                        </span>
                        {loggedDuration ? (
                            <span className="text-xs font-medium text-[var(--text-muted)] truncate">
                                • {loggedDuration}
                            </span>
                        ) : null}
                    </div>

                    {recurringMonthLabel ? (
                        <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                            {recurringMonthLabel}
                        </span>
                    ) : compactAgo ? (
                        <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                            {compactAgo}
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    )
}
