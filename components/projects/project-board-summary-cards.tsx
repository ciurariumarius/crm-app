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

function SummaryCard({
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-card/80 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
            <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-inner ${toneClass}`}>
                    {icon}
                </div>
                <p className="flex items-baseline gap-1.5 leading-none">
                    <span className="text-lg font-bold tracking-tight text-foreground">{value}</span>
                    <span className="ui-text-label text-muted-foreground">{label}</span>
                </p>
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
    return (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SummaryCard
                icon={<Layers className="h-4 w-4" />}
                value={totalCount}
                label="Total"
                toneClass="bg-blue-50 text-blue-600 border-blue-100"
            />
            <SummaryCard
                icon={<Zap className="h-4 w-4" />}
                value={oneTimeCount}
                label="One-time"
                toneClass="bg-emerald-50 text-emerald-600 border-emerald-100"
            />
            <SummaryCard
                icon={<RefreshCcw className="h-4 w-4" />}
                value={monthlyCount}
                label="Monthly"
                toneClass="bg-violet-50 text-violet-600 border-violet-100"
            />
            <SummaryCard
                icon={<Wallet className="h-4 w-4" />}
                value={totalAmountLabel}
                label="RON"
                toneClass="bg-emerald-50 text-emerald-600 border-emerald-100"
            />
            <SummaryCard
                icon={<Timer className="h-4 w-4" />}
                value={totalDurationLabel}
                label="Logged"
                toneClass="bg-amber-50 text-amber-600 border-amber-100"
            />
        </div>
    )
}

