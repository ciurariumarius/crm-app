import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusChipVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.02em]",
    {
        variants: {
            tone: {
                neutral: "border-slate-200 bg-slate-100 text-slate-600",
                active: "border-blue-200 bg-blue-50 text-blue-700",
                paused: "border-amber-200 bg-amber-50 text-amber-700",
                completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
                closed: "border-slate-300 bg-slate-200/70 text-slate-700",
                paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
                unpaid: "border-rose-200 bg-rose-50 text-rose-700",
                urgent: "border-rose-200 bg-rose-50 text-rose-700",
                idea: "border-amber-200 bg-amber-50 text-amber-700",
                normal: "border-slate-200 bg-slate-100 text-slate-600",
                recurring: "border-violet-200 bg-violet-50 text-violet-700",
                oneTime: "border-emerald-200 bg-emerald-50 text-emerald-700",
                outstanding: "border-rose-200 bg-rose-50 text-rose-700",
                settled: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
