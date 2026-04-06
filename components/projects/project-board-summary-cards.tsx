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
        <div className="relative overflow-hidden rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.03)] transition-all hover:shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-inner ${toneClass}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-lg font-bold leading-none tracking-tight text-foreground">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                </div>
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
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
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
