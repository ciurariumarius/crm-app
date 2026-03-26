import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusChipVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.03em] border",
    {
        variants: {
            tone: {
                neutral: "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]",
                active: "border-[color:color-mix(in_srgb,var(--state-active)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-active)_14%,white)] text-[var(--state-active)]",
                paused: "border-[color:color-mix(in_srgb,var(--state-paused)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-paused)_14%,white)] text-[var(--state-paused)]",
                completed: "border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,white)] text-[var(--state-success)]",
                closed: "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]",
                paid: "border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,white)] text-[var(--state-success)]",
                unpaid: "border-[color:color-mix(in_srgb,var(--state-urgent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_14%,white)] text-[var(--state-urgent)]",
                urgent: "border-[color:color-mix(in_srgb,var(--state-urgent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_14%,white)] text-[var(--state-urgent)]",
                idea: "border-[color:color-mix(in_srgb,var(--state-idea)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-idea)_14%,white)] text-[var(--state-idea)]",
                normal: "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]",
                recurring: "border-[color:color-mix(in_srgb,var(--brand-cyan)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_14%,white)] text-[var(--brand-primary)]",
                oneTime: "border-[color:color-mix(in_srgb,var(--brand-indigo)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-indigo)_14%,white)] text-[var(--brand-indigo)]",
                outstanding: "border-[color:color-mix(in_srgb,var(--state-overdue)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_14%,white)] text-[var(--state-overdue)]",
                settled: "border-[color:color-mix(in_srgb,var(--state-success)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,white)] text-[var(--state-success)]",
            },
            size: {
                xs: "h-5 px-2 text-[10px]",
                sm: "h-6 px-2.5 text-[11px]",
                md: "h-7 px-3 text-xs",
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
    children: React.ReactNode
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
