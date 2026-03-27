import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusChipVariants = cva(
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] transition-colors font-bold uppercase tracking-[0.05em]",
    {
        variants: {
            tone: {
                neutral: "bg-slate-100 text-slate-500",
                active: "bg-[#edf7ff] text-[#2563eb]",
                paused: "bg-amber-50 text-amber-600",
                completed: "bg-emerald-50 text-emerald-600",
                closed: "bg-slate-100 text-slate-500 shadow-sm",
                paid: "bg-emerald-50 text-emerald-600 border border-emerald-100/50",
                unpaid: "bg-[#fff1f2] text-[#be123c] border border-rose-100/50",
                urgent: "bg-rose-50 text-rose-600",
                idea: "bg-slate-100 text-slate-400 font-medium",
                normal: "bg-slate-100 text-slate-500",
                recurring: "bg-[#edf9fb] text-[#0b8fa8] border border-blue-100/50",
                oneTime: "bg-[#f1f5f9] text-[#475569] border border-slate-200/50",
                outstanding: "bg-amber-50 text-amber-600",
                settled: "bg-emerald-50 text-emerald-600",
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
