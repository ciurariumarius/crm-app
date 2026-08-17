import * as React from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type SidePanelTab = {
    value: string
    label: string
    badge?: React.ReactNode
}

type SidePanelTabsProps = {
    tabs: SidePanelTab[]
    value: string
    onValueChange: (value: string) => boolean | void
    ariaLabel: string
    className?: string
}

export function SidePanelTabs({ tabs, value, onValueChange, ariaLabel, className }: SidePanelTabsProps) {
    const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])

    const focusTab = (index: number) => {
        const normalizedIndex = (index + tabs.length) % tabs.length
        const tab = tabs[normalizedIndex]
        if (!tab) return
        const accepted = onValueChange(tab.value)
        if (accepted === false) return
        requestAnimationFrame(() => tabRefs.current[normalizedIndex]?.focus())
    }

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={cn(
                "flex min-w-max items-center gap-1 rounded-[14px] bg-[var(--surface-low)] p-1",
                className
            )}
        >
            {tabs.map((tab, index) => {
                const selected = value === tab.value
                return (
                    <button
                        key={tab.value}
                        ref={(node) => { tabRefs.current[index] = node }}
                        type="button"
                        role="tab"
                        id={`${ariaLabel.replaceAll(" ", "-").toLowerCase()}-${tab.value}-tab`}
                        aria-selected={selected}
                        aria-controls={`${ariaLabel.replaceAll(" ", "-").toLowerCase()}-${tab.value}-panel`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onValueChange(tab.value)}
                        onKeyDown={(event) => {
                            if (event.key === "ArrowRight") {
                                event.preventDefault()
                                focusTab(index + 1)
                            } else if (event.key === "ArrowLeft") {
                                event.preventDefault()
                                focusTab(index - 1)
                            } else if (event.key === "Home") {
                                event.preventDefault()
                                focusTab(0)
                            } else if (event.key === "End") {
                                event.preventDefault()
                                focusTab(tabs.length - 1)
                            }
                        }}
                        className={cn(
                            "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]",
                            selected
                                ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-sm"
                                : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_58%,transparent)] hover:text-[var(--text-primary)]"
                        )}
                    >
                        {tab.label}
                        {tab.badge !== undefined ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--surface-low)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--text-muted)]">
                                {tab.badge}
                            </span>
                        ) : null}
                    </button>
                )
            })}
        </div>
    )
}

type SidePanelDetailRowProps = {
    label: string
    value: React.ReactNode
    action?: React.ReactNode
    className?: string
}

export function SidePanelDetailRow({ label, value, action, className }: SidePanelDetailRowProps) {
    return (
        <div className={cn("flex min-h-14 items-center justify-between gap-4 border-b border-[var(--line-subtle)] py-3 last:border-b-0", className)}>
            <span className="shrink-0 text-sm font-medium text-[var(--text-muted)]">{label}</span>
            <div className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-semibold text-[var(--text-primary)]">
                <span className="min-w-0 truncate">{value}</span>
                {action}
            </div>
        </div>
    )
}

type SidePanelSectionTitleProps = {
    title: string
    icon?: React.ReactNode
    className?: string
}

export function SidePanelSectionTitle({ title, icon, className }: SidePanelSectionTitleProps) {
    return (
        <h2 className={cn("ui-text-section inline-flex items-center gap-2 text-[var(--text-secondary)]", className)}>
            {icon}
            {title}
        </h2>
    )
}

type SidePanelMetaBarProps = {
    entityLabel: string
    entityId: React.ReactNode
    createdAt: React.ReactNode
    updatedAt?: React.ReactNode
    onDelete?: () => void
    className?: string
}

export function SidePanelMetaBar({ entityLabel, entityId, createdAt, updatedAt, onDelete, className }: SidePanelMetaBarProps) {
    return (
        <div className={cn("mt-6 border-t border-[var(--line-subtle)] pt-6 text-[var(--text-secondary)]", className)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="ui-text-caption font-semibold text-[var(--text-secondary)]">
                        # {entityLabel}: {entityId}
                    </span>
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] text-[var(--text-muted)] transition hover:bg-[var(--state-danger-surface)] hover:text-[var(--state-urgent)]"
                            aria-label={`Delete ${entityLabel}`}
                            title={`Delete ${entityLabel}`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="ui-text-caption inline-flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-secondary)]">Created:</span>
                        {createdAt}
                    </span>
                    {updatedAt ? (
                        <span className="ui-text-caption inline-flex items-center gap-1.5 border-l border-[var(--line-subtle)] pl-3">
                            <span className="font-semibold text-[var(--text-secondary)]">Last Updated:</span>
                            {updatedAt}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

type SidePanelDangerZoneProps = {
    title?: string
    description?: string
    className?: string
    children: React.ReactNode
}

export function SidePanelDangerZone({
    title = "Danger zone",
    description,
    className,
    children,
}: SidePanelDangerZoneProps) {
    return (
        <div className={cn("pt-8 border-t border-dashed border-[color:color-mix(in_srgb,var(--state-overdue)_35%,transparent)]", className)}>
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                    <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--state-urgent)]">
                        <AlertTriangle className="h-4 w-4" />
                        {title}
                    </h4>
                    {description ? <p className="text-xs text-[var(--text-secondary)]">{description}</p> : null}
                </div>
                {children}
            </div>
        </div>
    )
}

type SidePanelChipTone = "slate" | "blue" | "emerald" | "rose" | "amber"

const CHIP_TONE_CLASS: Record<SidePanelChipTone, string> = {
    slate: "border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_78%,transparent)] text-[var(--text-secondary)]",
    blue: "border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_16%,transparent)] text-[var(--brand-primary)]",
    emerald: "border-[color:color-mix(in_srgb,var(--state-success)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,transparent)] text-[var(--state-success)]",
    rose: "border-[color:color-mix(in_srgb,var(--state-overdue)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_14%,transparent)] text-[var(--state-overdue)]",
    amber: "border-[color:color-mix(in_srgb,var(--state-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_14%,transparent)] text-[var(--state-warning)]",
}

export function sidePanelChipToneByLabel(label: string): SidePanelChipTone {
    const key = label.toLowerCase()
    if (key.includes("paid") || key.includes("completed") || key.includes("ready")) return "emerald"
    if (key.includes("unpaid") || key.includes("urgent") || key.includes("error") || key.includes("over")) return "rose"
    if (key.includes("active") || key.includes("saving") || key.includes("status")) return "blue"
    if (key.includes("pause") || key.includes("idea") || key.includes("deadline")) return "amber"
    return "slate"
}

type SidePanelChipProps = {
    label: React.ReactNode
    icon?: React.ReactNode
    tone?: SidePanelChipTone
    className?: string
}

export function SidePanelChip({ label, icon, tone = "slate", className }: SidePanelChipProps) {
    return (
        <span
            className={cn(
                "ui-text-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold",
                CHIP_TONE_CLASS[tone],
                className
            )}
        >
            {icon}
            {label}
        </span>
    )
}

type SidePanelInfoCardProps = {
    title: string
    subtitle?: React.ReactNode
    action?: React.ReactNode
    className?: string
    children?: React.ReactNode
}

export function SidePanelInfoCard({ title, subtitle, action, className, children }: SidePanelInfoCardProps) {
    return (
        <div className={cn("group rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] transition hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]", className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="ui-text-section text-[var(--text-secondary)]">{title}</p>
                    {subtitle ? <div className="mt-1">{subtitle}</div> : null}
                </div>
                {action}
            </div>
            {children ? <div className="mt-3">{children}</div> : null}
        </div>
    )
}

type SidePanelEmptyStateProps = {
    message: string
    className?: string
}

export function SidePanelEmptyState({ message, className }: SidePanelEmptyStateProps) {
    return (
        <div
            className={cn(
                "px-2 py-4 text-center text-xs font-medium text-[var(--text-muted)] opacity-80",
                className
            )}
        >
            {message}
        </div>
    )
}

type SidePanelLoadingStateProps = {
    message?: string
    className?: string
}

export function SidePanelLoadingState({ message = "Loading...", className }: SidePanelLoadingStateProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-4 py-5 text-xs font-medium text-[var(--text-secondary)]",
                className
            )}
        >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{message}</span>
        </div>
    )
}
