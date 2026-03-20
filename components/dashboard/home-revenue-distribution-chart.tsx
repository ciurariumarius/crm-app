"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts"

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

function formatCurrency(value: number) {
    return new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "RON",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

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
        return { label: "Low attention", className: "bg-rose-50 border-rose-200 text-rose-700" }
    }
    if ((hoursThisMonth || 0) <= 6) {
        return { label: "Moderate", className: "bg-amber-50 border-amber-200 text-amber-700" }
    }
    return { label: "High attention", className: "bg-emerald-50 border-emerald-200 text-emerald-700" }
}

export function HomeRevenueDistributionChart({ periodData }: HomeRevenueDistributionChartProps) {
    const [period, setPeriod] = React.useState<RevenuePeriodKey>("all_time")
    const [mode, setMode] = React.useState<RevenueMode>("project")

    const activeDataset = periodData[period]
    const source = activeDataset[mode]
    const rows = React.useMemo(() => [...source].sort((a, b) => b.revenue - a.revenue), [source])
    const chartData = React.useMemo(() => reduceForChart(rows), [rows])
    const totalRevenue = activeDataset.totalRevenue

    if (rows.length === 0) {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Revenue Analysis</p>
                <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No revenue data available.
                </p>
            </section>
        )
    }

    return (
        <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Revenue Analysis</p>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Date</span>
                    <select
                        value={period}
                        onChange={(event) => setPeriod(event.target.value as RevenuePeriodKey)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
                    >
                        {PERIOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                {MODE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={[
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                            mode === option.value
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        ].join(" ")}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="revenue"
                                nameKey="label"
                                innerRadius={82}
                                outerRadius={122}
                                paddingAngle={3}
                                stroke="transparent"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`${entry.key}-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => formatCurrency(Number(value))}
                                contentStyle={{
                                    borderRadius: 10,
                                    border: "1px solid rgb(226 232 240)",
                                    boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Total Revenue ({PERIOD_OPTIONS.find((option) => option.value === period)?.label})
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="max-h-[245px] space-y-2 overflow-auto pr-1">
                        {rows.map((entry, index) => {
                            const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0
                            const attention = mode === "project" ? getAttentionLabel(entry.hoursThisMonth) : null
                            return (
                                <div key={entry.key} className="rounded-xl border border-slate-200 px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                            <p className="truncate text-sm font-medium text-slate-800">{entry.label}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-slate-900">
                                            {formatCurrency(entry.revenue)}
                                        </p>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                                        <span>{share.toFixed(1)}% share</span>
                                        {mode === "project" ? (
                                            <span className={`rounded-md border px-2 py-0.5 font-semibold ${attention?.className}`}>
                                                {formatHours(entry.hoursThisMonth)} this month
                                            </span>
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
