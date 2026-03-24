"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, BarChart, Bar } from "recharts"
import { Timer, ArrowUpRight } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { PartnerSheetContent } from "@/components/vault/partner-sheet-content"
import { sidePanelClass } from "@/lib/ui/side-panels"
import { getProjectById } from "@/lib/actions/projects"
import { getSiteById } from "@/lib/actions/sites"
import { toast } from "sonner"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"

export type RevenuePeriodKey = "all_time" | "this_month" | "last_month" | "this_quarter" | "this_year"
type RevenueMode = "partner" | "domain" | "project"

export type RevenueAnalysisEntry = {
    key: string
    label: string
    revenue: number
    hoursThisMonth?: number
    openProjectId?: string
    openPartnerId?: string
    openSiteId?: string
    latestCreatedAtMs?: number
}

export type RevenuePeriodDataset = {
    totalRevenue: number
    partner: RevenueAnalysisEntry[]
    domain: RevenueAnalysisEntry[]
    project: RevenueAnalysisEntry[]
}

type HomeRevenueDistributionChartProps = {
    periodData: Record<RevenuePeriodKey, RevenuePeriodDataset>
    allServices: Service[]
    hourlyRate?: number
}

const COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Green
    "#eab308", // Yellow
    "#f97316", // Orange
    "#ef4444", // Red
    "#1e293b", // Slate 900
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#64748b", // Slate
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

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    // Position text in the exact center of the donut ring
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    // Hide labels for very small slices to prevent text overlapping
    if (percent < 0.04) return null

    return (
        <text
            x={x}
            y={y}
            fill="rgba(255,255,255,0.9)"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11.5px] font-semibold tracking-tight pointer-events-none"
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    )
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
        return { label: "Low attention", className: "bg-slate-50 border-slate-200 text-slate-500" }
    }
    if ((hoursThisMonth || 0) <= 6) {
        return { label: "Moderate", className: "bg-amber-50 border-amber-200 text-amber-700" }
    }
    return { label: "High attention", className: "bg-emerald-50 border-emerald-200 text-emerald-700" }
}

export function HomeRevenueDistributionChart({ periodData, allServices, hourlyRate = 0 }: HomeRevenueDistributionChartProps) {
    const [period, setPeriod] = React.useState<RevenuePeriodKey>("all_time")
    const [mode, setMode] = React.useState<RevenueMode>("project")
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<(Site & { partner?: { id: string; name: string } }) | null>(null)
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null)
    const [isOpeningEntity, setIsOpeningEntity] = React.useState(false)
    const [isListExpanded, setIsListExpanded] = React.useState(false)
    const [activeSegment, setActiveSegment] = React.useState<string | null>(null)

    React.useEffect(() => {
        setActiveSegment(null)
        setIsListExpanded(false)
    }, [mode, period])

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            // If the user clicks on a Recharts pie slice, do nothing here.
            if (target?.closest?.(".recharts-sector")) {
                return
            }
            setActiveSegment(null)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const activeDataset = periodData[period]
    const source = activeDataset[mode]
    const rows = React.useMemo(() => [...source].sort((a, b) => b.revenue - a.revenue), [source])
    const chartData = React.useMemo(() => reduceForChart(rows), [rows])
    const totalRevenue = activeDataset.totalRevenue
    const totalCount = rows.length

    const openRowEntity = React.useCallback(async (entry: RevenueAnalysisEntry) => {
        if (mode === "project") {
            if (!entry.openProjectId) return
            setIsOpeningEntity(true)
            try {
                const result = await getProjectById(entry.openProjectId)
                if (!result.success || !result.data) {
                    toast.error(result.error || "Failed to load project")
                    return
                }
                setSelectedProject(result.data as ProjectWithDetails)
            } catch {
                toast.error("Failed to load project")
            } finally {
                setIsOpeningEntity(false)
            }
            return
        }

        if (mode === "partner") {
            if (!entry.openPartnerId) return
            setSelectedPartnerId(entry.openPartnerId)
            return
        }

        if (!entry.openSiteId) return
        setIsOpeningEntity(true)
        try {
            const result = await getSiteById(entry.openSiteId)
            if (!result.success || !result.site) {
                toast.error(result.error || "Failed to load domain")
                return
            }
            setSelectedSite(result.site as Site & { partner?: { id: string; name: string } })
        } catch {
            toast.error("Failed to load domain")
        } finally {
            setIsOpeningEntity(false)
        }
    }, [mode])

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

    return (
        <section className="rounded-[24px] border border-slate-100 bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                        <div className="h-[22px] w-[5px] rounded-full bg-blue-600" />
                        <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">Revenue Analysis</h3>
                    </div>
                    {/* Period Selector */}
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-100/60 px-3 py-1.5 text-xs font-bold tracking-tight text-slate-600">
                        <span>Date:</span>
                        <select
                            value={period}
                            onChange={(event) => setPeriod(event.target.value as RevenuePeriodKey)}
                            className="bg-transparent font-bold outline-none cursor-pointer tracking-tight"
                        >
                            {PERIOD_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value} className="bg-white text-slate-900">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="flex items-center gap-1 rounded-full bg-slate-100/60 p-1">
                    {MODE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setMode(option.value)}
                            className={cn(
                                "rounded-full px-5 py-1.5 text-[11px] font-bold transition-all tracking-tight",
                                mode === option.value
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-12 lg:grid-cols-[400px_1fr] items-center">
                <div className="relative flex items-center justify-center h-[340px]">
                    <div className="absolute inset-0 z-0 outline-none">
                        <ResponsiveContainer width="100%" height="100%" className="outline-none">
                            <PieChart style={{ outline: 'none' }}>
                                <Pie
                                    data={chartData}
                                    dataKey="revenue"
                                    nameKey="label"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={105}
                                    outerRadius={145}
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="white"
                                    strokeWidth={4}
                                    style={{ outline: 'none' }}
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    isAnimationActive={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`${entry.key}-${index}`} 
                                            fill={COLORS[index]} 
                                            style={{ 
                                                cursor: "pointer", 
                                                outline: "none",
                                                opacity: activeSegment && activeSegment !== entry.key ? 0.3 : 1, 
                                                transition: "opacity 0.2s" 
                                            }}
                                            onClick={() => {
                                                const newActive = activeSegment === entry.key ? null : entry.key;
                                                setActiveSegment(newActive);
                                                if (newActive && index >= 4) setIsListExpanded(true);
                                            }}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Central Label */}
                    <div className="relative z-10 flex flex-col items-center justify-center pt-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Total Revenue</p>
                        <p className="mt-1 text-[36px] font-bold text-slate-900 leading-none tracking-tight">
                            {formatCurrency(totalRevenue).replace(/[\s\u00A0]*RON/i, "")} <span className="text-[14px] text-slate-400 font-bold ml-1">RON</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col justify-center gap-3">
                        {(isListExpanded ? chartData : chartData.slice(0, 4)).map((entry, index) => {
                            const isOther = entry.key === "__other__"
                        const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0
                        
                        // We cast back because our entry from reduceForChart might not align perfectly with active dataset
                        const originalEntry = isOther ? null : rows.find(r => r.key === entry.key)
                        const attention = mode === "project" ? getAttentionLabel(originalEntry?.hoursThisMonth) : null
                        const canOpen = !isOther && (
                            mode === "project" ? Boolean(originalEntry?.openProjectId) :
                            mode === "partner" ? Boolean(originalEntry?.openPartnerId) :
                            Boolean(originalEntry?.openSiteId)
                        )
                        const dotColor = COLORS[index]
                        const isHighlighted = activeSegment === entry.key
                        
                        return (
                            <button
                                key={entry.key}
                                type="button"
                                onClick={() => {
                                    if (canOpen && originalEntry) void openRowEntity(originalEntry)
                                }}
                                disabled={!canOpen}
                                className={cn(
                                    "flex items-center justify-between gap-4 rounded-[16px] px-5 py-4 text-left transition-all",
                                    isHighlighted ? "bg-white ring-2 ring-blue-500 shadow-lg scale-[1.02] z-10 relative" : "bg-[#F8F9FB] border border-transparent",
                                    canOpen && !isHighlighted ? "group cursor-pointer hover:bg-[#F1F3F7]" : !canOpen && !isHighlighted ? "cursor-default" : ""
                                )}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: dotColor }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <p className="truncate text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                            {entry.label}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            {isOther ? "Multiple small items" : originalEntry?.hoursThisMonth ? `${formatHours(originalEntry.hoursThisMonth)} this month` : "0.0h this month"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end shrink-0">
                                    <p className="text-[14px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                        {formatCurrency(entry.revenue)}
                                    </p>
                                    <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                        {share.toFixed(1)}%
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                    </div>
                    {chartData.length > 4 && (
                        <button
                            onClick={() => setIsListExpanded(!isListExpanded)}
                            className="text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-colors w-full text-center py-2.5 rounded-xl hover:bg-slate-50/80 border border-transparent hover:border-slate-200/60"
                        >
                            {isListExpanded ? "Show less" : `View all ${totalCount} ${mode}s`}
                        </button>
                    )}
                </div>
            </div>

            <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("default", 1)}>
                    <SheetTitle className="sr-only">Project details</SheetTitle>
                    {selectedProject ? (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onUpdate={(updated) => setSelectedProject(updated)}
                            onOpenSite={(site) => setSelectedSite(site)}
                            onClose={() => setSelectedProject(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>

            <Sheet open={Boolean(selectedSite)} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("default", 2)}>
                    <SheetTitle className="sr-only">Domain details</SheetTitle>
                    {selectedSite ? (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onClose={() => setSelectedSite(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>

            <Sheet open={Boolean(selectedPartnerId)} onOpenChange={(open) => !open && setSelectedPartnerId(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("default", 1)}>
                    <SheetTitle className="sr-only">Partner details</SheetTitle>
                    {selectedPartnerId ? (
                        <PartnerSheetContent
                            partnerId={selectedPartnerId}
                            onClose={() => setSelectedPartnerId(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>

            {isOpeningEntity ? (
                <div className="pointer-events-none fixed inset-0 z-[79] bg-transparent" aria-hidden="true" />
            ) : null}
        </section>
    )
}
