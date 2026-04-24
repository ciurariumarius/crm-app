"use client"

import * as React from "react"
import { Layers, RefreshCcw, Timer, Wallet, Zap } from "lucide-react"

type ProjectBoardSummaryCardsProps = {
    totalCount: number
    oneTimeCount: number
    monthlyCount: number
    totalAmountLabel: string
    totalDurationLabel: string
}

const summaryRowClass =
    "flex w-max min-w-full overflow-hidden rounded-[22px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] xl:w-full"
const summaryItemClass =
    "group relative flex min-w-[182px] items-center gap-3 px-3.5 py-3 transition-all hover:bg-[var(--surface-lowest)]/60 xl:min-w-0 xl:flex-1"
const summaryIconContainerClass =
    "flex h-8 w-8 items-center justify-center rounded-[10px] border bg-[var(--surface-lowest)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_3px_rgba(15,23,42,0.08)]"

function SummaryItem({
    icon,
    value,
    label,
    toneClass,
}: {
    icon: React.ReactNode
    value: React.ReactNode
    label: string
    toneClass: string
}) {
    return (
        <div className={summaryItemClass}>
            <div className={`${summaryIconContainerClass} ${toneClass}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-none text-[var(--text-secondary)]">{label}</p>
                <p className="mt-1 text-[12px] font-medium leading-none text-[var(--text-secondary)]">{value}</p>
            </div>
        </div>
    )
}

export function ProjectBoardSummaryCards({
    totalCount,
    oneTimeCount,
    monthlyCount,
    totalAmountLabel,
    totalDurationLabel,
}: ProjectBoardSummaryCardsProps) {
    const summaryItems = [
        {
            icon: <Layers className="h-3.5 w-3.5" />,
            value: totalCount,
            label: "Total Projects",
            toneClass: "border-blue-100/80 bg-blue-50/80 text-blue-700",
        },
        {
            icon: <Zap className="h-3.5 w-3.5" />,
            value: oneTimeCount,
            label: "One-Time Projects",
            toneClass: "border-emerald-100/80 bg-emerald-50/80 text-emerald-700",
        },
        {
            icon: <RefreshCcw className="h-3.5 w-3.5" />,
            value: monthlyCount,
            label: "Monthly Projects",
            toneClass: "border-violet-100/80 bg-violet-50/80 text-violet-700",
        },
        {
            icon: <Wallet className="h-3.5 w-3.5" />,
            value: totalAmountLabel,
            label: "Total Amount",
            toneClass: "border-teal-100/80 bg-teal-50/80 text-teal-700",
        },
        {
            icon: <Timer className="h-3.5 w-3.5" />,
            value: totalDurationLabel,
            label: "Logged Time",
            toneClass: "border-amber-100/80 bg-amber-50/80 text-amber-700",
        },
    ]

    return (
        <div className="mt-5 overflow-x-auto pb-1 xl:overflow-visible hidescrollbar">
            <div className={summaryRowClass}>
                {summaryItems.map((item, index) => (
                    <div
                        key={item.label}
                        className={`flex-1 ${index < summaryItems.length - 1 ? "border-r border-[var(--line-subtle)]" : ""}`}
                    >
                        <SummaryItem icon={item.icon} value={item.value} label={item.label} toneClass={item.toneClass} />
                    </div>
                ))}
            </div>
        </div>
    )
}
