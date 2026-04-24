import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusChipVariants = cva(
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] transition-colors font-bold uppercase tracking-[0.05em]",
    {
        variants: {
            tone: {
                neutral: "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] text-[var(--text-secondary)]",
                active: "border border-[color:color-mix(in_srgb,var(--state-active)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-active)_16%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-active)_84%,var(--text-primary))]",
                paused: "border border-[color:color-mix(in_srgb,var(--state-warning)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-warning)_84%,var(--text-primary))]",
                completed: "border border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-success)_84%,var(--text-primary))]",
                closed: "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] text-[var(--text-secondary)] shadow-sm",
                paid: "border border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-success)_84%,var(--text-primary))]",
                unpaid: "border border-[color:color-mix(in_srgb,var(--state-urgent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-urgent)_84%,var(--text-primary))]",
                urgent: "border border-[color:color-mix(in_srgb,var(--state-urgent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-urgent)_84%,var(--text-primary))]",
                idea: "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] text-[var(--text-muted)] font-medium",
                normal: "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] text-[var(--text-secondary)]",
                recurring: "border border-[color:color-mix(in_srgb,var(--brand-cyan)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--brand-cyan)_82%,var(--text-primary))]",
                oneTime: "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] text-[var(--text-secondary)]",
                outstanding: "border border-[color:color-mix(in_srgb,var(--state-warning)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-warning)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-warning)_84%,var(--text-primary))]",
                settled: "border border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-success)_84%,var(--text-primary))]",
            },
            size: {
                xs: "h-5 px-2 text-[10px]",
                sm: "h-[34px] px-3 text-[11px]",
                md: "h-9 px-4 text-xs",
                icon: "h-9 w-9 p-0",
            },
        },
        defaultVariants: {
            tone: "neutral",
            size: "sm",
        },
    }
)

export type StatusChipTone = NonNullable<VariantProps<typeof statusChipVariants>["tone"]>
export type StatusChipSize = NonNullable<VariantProps<typeof statusChipVariants>["size"]>

export function StatusChip({
    tone = "neutral",
    size = "sm",
    icon,
    className,
    children,
}: {
    tone?: StatusChipTone
    size?: StatusChipSize
    icon?: React.ReactNode
    className?: string
    children?: React.ReactNode
}) {
    return (
        <span className={cn(statusChipVariants({ tone, size }), className)}>
            {icon}
            {children}
        </span>
    )
}

export function statusToneFromLabel(value: string | null | undefined): StatusChipTone {
    const key = (value || "").toLowerCase()
    if (key.includes("paid")) return "paid"
    if (key.includes("unpaid")) return "unpaid"
    if (key.includes("active")) return "active"
    if (key.includes("paused")) return "paused"
    if (key.includes("complete")) return "completed"
    if (key.includes("closed")) return "closed"
    if (key.includes("urgent")) return "urgent"
    if (key.includes("idea")) return "idea"
    if (key.includes("recurr")) return "recurring"
    if (key.includes("one")) return "oneTime"
    if (key.includes("outstand")) return "outstanding"
    if (key.includes("settled")) return "settled"
    if (key.includes("normal")) return "normal"
    return "neutral"
}
