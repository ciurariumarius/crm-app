import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type SidePanelSectionTitleProps = {
    title: string
    icon?: React.ReactNode
    className?: string
}

export function SidePanelSectionTitle({ title, icon, className }: SidePanelSectionTitleProps) {
    return (
        <h2 className={cn("ui-text-section inline-flex items-center gap-2 text-slate-500", className)}>
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
    className?: string
}

export function SidePanelMetaBar({ entityLabel, entityId, createdAt, updatedAt, className }: SidePanelMetaBarProps) {
    return (
        <div className={cn("mt-12 border-t border-slate-200 pt-8 text-slate-500", className)}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="ui-text-caption font-semibold text-slate-500">
                    # {entityLabel}: {entityId}
                </span>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="ui-text-caption inline-flex items-center gap-1.5">
                        <span className="font-semibold text-slate-500">Created:</span>
                        {createdAt}
                    </span>
                    {updatedAt ? (
                        <span className="ui-text-caption inline-flex items-center gap-1.5 border-l border-slate-200 pl-3">
                            <span className="font-semibold text-slate-500">Last Updated:</span>
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
        <div className={cn("pt-8 border-t border-rose-100 border-dashed", className)}>
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                    <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600">
                        <AlertTriangle className="h-4 w-4" />
                        {title}
                    </h4>
                    {description ? <p className="text-xs text-slate-500">{description}</p> : null}
                </div>
                {children}
            </div>
        </div>
    )
}

type SidePanelChipTone = "slate" | "blue" | "emerald" | "rose" | "amber"

const CHIP_TONE_CLASS: Record<SidePanelChipTone, string> = {
    slate: "border-slate-200 bg-slate-100 text-slate-600",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
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
        <div className={cn("group rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300", className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="ui-text-section text-slate-500">{title}</p>
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
                "rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-[12px] font-medium text-slate-500",
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
                "flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-[12px] font-medium text-slate-500",
                className
            )}
        >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{message}</span>
        </div>
    )
}
