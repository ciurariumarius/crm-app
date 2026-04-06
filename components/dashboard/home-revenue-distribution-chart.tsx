"use client"

import * as React from "react"
import { format } from "date-fns"
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDown } from "lucide-react"
import { detectLmsDatePresetId, getLmsDatePresets, type LmsDatePreset } from "@/lib/lms-tasks/date-presets"
import type { DateRange } from "react-day-picker"

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

export type RevenueSourceProject = {
  id: string
  currentFee: number
  createdAt: string
  hoursThisMonth?: number
  label: string
  site: {
    id?: string | null
    domainName?: string | null
    partner?: { id: string; name: string } | null
  } | null
  services: Array<{ serviceName?: string | null; isRecurring?: boolean | null }>
}

type HomeRevenueDistributionChartProps = {
    sourceProjects: RevenueSourceProject[]
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

const MODE_OPTIONS: Array<{ label: string; value: RevenueMode }> = [
    { label: "Partner", value: "partner" },
    { label: "Domain", value: "domain" },
    { label: "Project", value: "project" },
]

type PieLabelProps = {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
}

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelProps) => {
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

function presetDateToUtc(value: string | null) {
    if (!value) return undefined
    return new Date(`${value}T12:00:00Z`)
}

function toIsoDate(value: Date) {
    return format(value, "yyyy-MM-dd")
}

function normalizeDomainLabel(value: string | null | undefined) {
    const normalized = (value || "").trim()
    return normalized || "Unknown Domain"
}

function isProjectIncludedInRange(project: RevenueSourceProject, range?: DateRange) {
    if (!range?.from && !range?.to) return true
    const createdAt = new Date(project.createdAt)
    if (Number.isNaN(createdAt.getTime())) return false

    const effectiveEnd = range?.to ?? range?.from
    if (!effectiveEnd) return true

    const inclusiveEnd = new Date(effectiveEnd)
    inclusiveEnd.setHours(23, 59, 59, 999)
    return createdAt <= inclusiveEnd
}

function toSortedRows(map: Map<string, RevenueAnalysisEntry>) {
    return Array.from(map.values())
        .filter((entry) => entry.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
}

function buildRevenueDataset(projects: RevenueSourceProject[], range?: DateRange): RevenuePeriodDataset {
    const partner = new Map<string, RevenueAnalysisEntry>()
    const domain = new Map<string, RevenueAnalysisEntry>()
    const project = new Map<string, RevenueAnalysisEntry>()
    let totalRevenue = 0

    for (const sourceProject of projects) {
        if (!isProjectIncludedInRange(sourceProject, range)) continue
        const fee = Number(sourceProject.currentFee || 0)
        if (fee <= 0) continue

        totalRevenue += fee

        const partnerId = sourceProject.site?.partner?.id || sourceProject.site?.partner?.name || "unknown-partner"
        const partnerLabel = sourceProject.site?.partner?.name || "Unknown Partner"
        const domainId = sourceProject.site?.id || normalizeDomainLabel(sourceProject.site?.domainName)
        const domainLabel = normalizeDomainLabel(sourceProject.site?.domainName)

        const partnerEntry = partner.get(partnerId) || {
            key: partnerId,
            label: partnerLabel,
            revenue: 0,
            openPartnerId: sourceProject.site?.partner?.id,
        }
        partnerEntry.revenue += fee
        partner.set(partnerId, partnerEntry)

        const domainEntry = domain.get(domainId) || {
            key: String(domainId),
            label: domainLabel,
            revenue: 0,
            openSiteId: sourceProject.site?.id || undefined,
            openPartnerId: sourceProject.site?.partner?.id || undefined,
        }
        domainEntry.revenue += fee
        domain.set(String(domainId), domainEntry)

        const projectEntry = project.get(sourceProject.id) || {
            key: sourceProject.id,
            label: sourceProject.label,
            revenue: 0,
            hoursThisMonth: sourceProject.hoursThisMonth || 0,
            openProjectId: sourceProject.id,
            openSiteId: sourceProject.site?.id || undefined,
            openPartnerId: sourceProject.site?.partner?.id || undefined,
            latestCreatedAtMs: new Date(sourceProject.createdAt).getTime(),
        }
        projectEntry.revenue += fee
        project.set(sourceProject.id, projectEntry)
    }

    return {
        totalRevenue,
        partner: toSortedRows(partner),
        domain: toSortedRows(domain),
        project: toSortedRows(project),
    }
}

function reduceForChart(data: RevenueAnalysisEntry[], max = 8) {
    const sorted = [...data].filter((entry) => entry.revenue > 0).sort((a, b) => b.revenue - a.revenue)
    if (sorted.length <= max) return sorted

    const kept = sorted.slice(0, max)
    const otherTotal = sorted.slice(max).reduce((sum, entry) => sum + entry.revenue, 0)
    return [...kept, { key: "__other__", label: "Other", revenue: otherTotal }]
}

function RevenueDateFilter({
    label,
    presets,
    activePresetId,
    selectedRange,
    onSelectPreset,
    onSelectRange,
}: {
    label: string
    presets: LmsDatePreset[]
    activePresetId: string
    selectedRange: DateRange | undefined
    onSelectPreset: (presetId: string) => void
    onSelectRange: (range: DateRange) => void
}) {
    const [open, setOpen] = React.useState(false)
    const [range, setRange] = React.useState<DateRange | undefined>(selectedRange)

    React.useEffect(() => {
        setRange(selectedRange)
    }, [selectedRange])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 min-w-[148px] items-center justify-between gap-2 rounded-xl border px-3 text-xs font-semibold transition-all",
                        activePresetId !== "all"
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                            : "border-slate-200 bg-slate-100/60 text-slate-700 hover:bg-slate-100"
                    )}
                >
                    <span className="max-w-[180px] truncate">{label}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                collisionPadding={16}
                className="w-[min(calc(100vw-2rem),440px)] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-apple)]"
            >
                <div className="flex max-h-[124px] flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {presets.map((preset, index) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                                onSelectPreset(preset.id)
                                setOpen(false)
                            }}
                            className={cn(
                                "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-medium transition-colors",
                                index === 0 ? "w-full" : "w-[calc(50%-4px)]",
                                activePresetId === preset.id
                                    ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                                    : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                            )}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <div className="my-2 h-px bg-[var(--line-subtle)]" />

                <Calendar
                    mode="range"
                    selected={range}
                    onSelect={(nextRange) => {
                        setRange(nextRange)
                        if (nextRange?.from && nextRange?.to) {
                            onSelectRange(nextRange)
                            setOpen(false)
                        }
                    }}
                    numberOfMonths={1}
                    className="w-full rounded-[12px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_70%,white)] p-0.5 text-sm [&_[data-slot=calendar]]:![--cell-size:clamp(24px,6vw,30px)]"
                    classNames={{
                        root: "w-full p-1",
                        months: "relative w-full",
                        month: "w-full",
                        month_grid: "w-full table-fixed border-collapse",
                        weekdays: "grid w-full grid-cols-7",
                        weekday: "text-center text-[11px] font-medium text-[var(--text-secondary)]",
                        weeks: "w-full",
                        week: "mt-1 grid w-full grid-cols-7",
                        day: "w-full",
                        nav: "absolute inset-x-0 top-1 flex w-full items-center justify-between px-1",
                        month_caption: "flex h-7 w-full items-center justify-center px-8 text-sm",
                        button_previous: "h-6 w-6",
                        button_next: "h-6 w-6",
                    }}
                />

                <div className="mt-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            onSelectPreset("all")
                            setOpen(false)
                        }}
                        className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Clear range
                    </button>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Pick start and end date
                    </span>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function HomeRevenueDistributionChart({ sourceProjects, allServices, hourlyRate = 0 }: HomeRevenueDistributionChartProps) {
    const presets = React.useMemo(() => getLmsDatePresets(), [])
    const [period, setPeriod] = React.useState<string>("all")
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>(undefined)
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

    const activePresetId = React.useMemo(() => {
        if (customRange?.from || customRange?.to) {
            const from = customRange?.from ? toIsoDate(customRange.from) : null
            const to = customRange?.to ? toIsoDate(customRange.to) : null
            return detectLmsDatePresetId(from, to, "custom")
        }
        return period
    }, [customRange, period])

    const selectedRange = React.useMemo(() => {
        if (customRange?.from || customRange?.to) return customRange
        const preset = presets.find((item) => item.id === period)
        if (!preset) return undefined
        const from = presetDateToUtc(preset.from)
        const to = presetDateToUtc(preset.to)
        if (!from && !to) return undefined
        return { from, to }
    }, [customRange, period, presets])

    const dateLabel = React.useMemo(() => {
        if (activePresetId === "custom") {
            return `${selectedRange?.from ? format(selectedRange.from, "dd MMM yyyy") : "..."} - ${selectedRange?.to ? format(selectedRange.to, "dd MMM yyyy") : "..."}`
        }
        return presets.find((item) => item.id === activePresetId)?.label || "All Time"
    }, [activePresetId, presets, selectedRange])

    const activeDataset = React.useMemo(
        () => buildRevenueDataset(sourceProjects, selectedRange),
        [selectedRange, sourceProjects]
    )
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
                    <RevenueDateFilter
                        label={dateLabel}
                        presets={presets}
                        activePresetId={activePresetId}
                        selectedRange={selectedRange}
                        onSelectPreset={(presetId) => {
                            setPeriod(presetId)
                            setCustomRange(undefined)
                        }}
                        onSelectRange={(range) => {
                            setPeriod("custom")
                            setCustomRange(range)
                        }}
                    />
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
