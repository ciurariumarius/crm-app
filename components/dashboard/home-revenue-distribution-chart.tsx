"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, BarChart, Bar } from "recharts"
import { TrendingUp, BarChart3, Timer } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"

export type RevenuePeriodKey = "all_time" | "this_month" | "last_month" | "this_quarter" | "this_year"
type RevenueMode = "partner" | "domain" | "project"

export type RevenueAnalysisEntry = {
    key: string
    label: string
    revenue: number
    hoursThisMonth?: number
}

export type RevenuePeriodDataset = {
    totalRevenue: number
    partner: RevenueAnalysisEntry[]
    domain: RevenueAnalysisEntry[]
    project: RevenueAnalysisEntry[]
}

type HomeRevenueDistributionChartProps = {
    periodData: Record<RevenuePeriodKey, RevenuePeriodDataset>
    growthData?: Record<RevenuePeriodKey, number>
}

const COLORS = [
    "hsl(var(--chart-1, 221.2 83.2% 53.3%))",
    "hsl(var(--chart-2, 142.1 76.2% 36.3%))",
    "hsl(var(--chart-3, 47.9 95.8% 51.8%))",
    "hsl(var(--chart-4, 24.3 91.1% 65.1%))",
    "hsl(var(--chart-5, 346.8 77.2% 49.8%))",
    "hsl(var(--primary))",
    "#4f46e5",
    "#0f766e",
    "#0891b2",
    "#be123c",
]

const PERIOD_OPTIONS: Array<{ label: string; value: RevenuePeriodKey }> = [
    { label: "All time", value: "all_time" },
    { label: "This month", value: "this_month" },
    { label: "Last month", value: "last_month" },
    { label: "This quarter", value: "this_quarter" },
    { label: "This year", value: "this_year" },
]

const MODE_OPTIONS: Array<{ label: string; value: RevenueMode }> = [
    { label: "Partner", value: "partner" },
    { label: "Domain", value: "domain" },
    { label: "Project", value: "project" },
]


function formatHours(value: number | undefined) {
    return `${(value || 0).toFixed(1)}h`
}

function reduceForChart(data: RevenueAnalysisEntry[], max = 8) {
    const sorted = [...data].filter((entry) => entry.revenue > 0).sort((a, b) => b.revenue - a.revenue)
    if (sorted.length <= max) return sorted

    const kept = sorted.slice(0, max)
    const otherTotal = sorted.slice(max).reduce((sum, entry) => sum + entry.revenue, 0)
    return [...kept, { key: "__other__", label: "Other", revenue: otherTotal }]
}

function getAttentionLabel(hoursThisMonth: number | undefined) {
    if ((hoursThisMonth || 0) <= 2) {
        return { label: "Low attention", className: "bg-slate-50 border-slate-200 text-slate-500" }
    }
    if ((hoursThisMonth || 0) <= 6) {
        return { label: "Moderate", className: "bg-amber-50 border-amber-200 text-amber-700" }
    }
    return { label: "High attention", className: "bg-emerald-50 border-emerald-200 text-emerald-700" }
}

export function HomeRevenueDistributionChart({ periodData, growthData }: HomeRevenueDistributionChartProps) {
    const [period, setPeriod] = React.useState<RevenuePeriodKey>("all_time")
    const [mode, setMode] = React.useState<RevenueMode>("project")

    const activeDataset = periodData[period]
    const source = activeDataset[mode]
    const rows = React.useMemo(() => [...source].sort((a, b) => b.revenue - a.revenue), [source])
    const chartData = React.useMemo(() => reduceForChart(rows), [rows])
    const totalRevenue = activeDataset.totalRevenue
    const totalCount = rows.length

    if (rows.length === 0) {
        return (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="ui-text-section text-slate-900">Revenue Analysis</p>
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No revenue data available for this period.
                </p>
            </section>
        )
    }

    const growth = (growthData && growthData[period]) || 0

    return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="ui-text-title text-slate-900">Revenue Analysis</h3>
                
                <div className="flex items-center gap-3">
                    {/* Mode Switcher */}
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50">
                        {MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setMode(option.value)}
                                className={cn(
                                    "rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all",
                                    mode === option.value
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {/* Period Selector */}
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/50 shadow-inner-sm">
                        <select
                            value={period}
                            onChange={(event) => setPeriod(event.target.value as RevenuePeriodKey)}
                            className="rounded-lg bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 shadow-sm outline-none transition-all cursor-pointer hover:bg-slate-50"
                        >
                            {PERIOD_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value} className="bg-white text-slate-700">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid gap-12 lg:grid-cols-[400px_1fr]">
                <div className="relative flex items-center justify-center h-[280px]">
                    <div className="absolute inset-0 z-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="revenue"
                                    nameKey="label"
                                    cx="50%"
                                    cy="55%"
                                    innerRadius={80}
                                    outerRadius={125}
                                    startAngle={210}
                                    endAngle={-30}
                                    stroke="white"
                                    strokeWidth={3}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`${entry.key}-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(Number(value))}
                                    contentStyle={{
                                        borderRadius: 12,
                                        border: "1px solid rgb(226 232 240)",
                                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Central Label */}
                    <div className="relative z-10 text-center mt-[-10px]">
                        <p className="ui-overline text-slate-400">Total {mode}s</p>
                        <p className="text-[38px] font-black text-slate-900 leading-none mt-1">{totalCount}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Total Revenue Summary Sub-card */}
                    <div className="rounded-[18px] bg-slate-50/50 border border-slate-100 p-4 py-3 flex items-center justify-between shadow-inner">
                        <div className="space-y-0.5">
                            <p className="ui-overline text-slate-400">Total Revenue ({PERIOD_OPTIONS.find(p => p.value === period)?.label})</p>
                            <div className="flex items-center gap-3">
                                <p className="text-[22px] font-bold text-slate-900 tracking-tight">
                                    {formatCurrency(totalRevenue)}
                                </p>
                                <div className="h-6 w-10 text-blue-500 opacity-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData.slice(0, 5)}>
                                            <Bar dataKey="revenue" fill="currentColor" radius={[1, 1, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
                        {rows.slice(0, 10).map((entry, index) => {
                            const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0
                            const attention = mode === "project" ? getAttentionLabel(entry.hoursThisMonth) : null
                            return (
                                <div key={entry.key} className="flex items-start justify-between gap-4 group cursor-pointer border-b border-transparent hover:border-slate-100 py-1 transition-all">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <span
                                            className="h-2.5 w-2.5 shrink-0 rounded-full mt-1.5 shadow-sm"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <p className="truncate ui-text-label text-slate-800 font-semibold group-hover:text-blue-600 transition-colors">
                                                {entry.label}
                                            </p>
                                            <p className="ui-text-caption text-slate-400 mt-0.5">
                                                {share.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end shrink-0">
                                        <p className="ui-text-label font-bold text-slate-900">
                                            {formatCurrency(entry.revenue)}
                                        </p>
                                        {mode === "project" ? (
                                            <div className={cn(
                                                "mt-1 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none shadow-sm",
                                                attention?.className
                                            )}>
                                                <Timer className="h-2.5 w-2.5" />
                                                <span>{formatHours(entry.hoursThisMonth)}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </section>
    )
}
