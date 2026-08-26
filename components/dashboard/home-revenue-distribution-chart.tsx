"use client"

import * as React from "react"
import { format } from "date-fns"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts"
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

type RevenueMode = "partner" | "domain" | "project" | "type"

export type RevenueAnalysisEntry = {
    key: string
    label: string
    revenue: number
    projectCount?: number
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
  type: RevenueAnalysisEntry[]
}

export type RevenueSourceProject = {
  id: string
  currentFee: number
  createdAt: string
  revenueType: "recurring" | "one-time"
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
    "var(--brand-primary)",
    "#70d1a7",
    "#a7dfc7",
    "var(--state-review)",
    "var(--state-warning)",
    "var(--brand-indigo)",
    "#2f6f55",
    "#8fb8a4",
    "var(--info)",
    "var(--text-muted)",
]

const MODE_OPTIONS: Array<{ label: string; value: RevenueMode }> = [
    { label: "Partner", value: "partner" },
    { label: "Domain", value: "domain" },
    { label: "Project", value: "project" },
    { label: "Type", value: "type" },
]

const MAX_CHART_SEGMENTS = 8
const COLLAPSED_LIST_SIZE = 4

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
            fill="var(--text-primary)"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11.5px] font-semibold tracking-tight pointer-events-none"
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    )
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

    const effectiveStart = range?.from ? new Date(range.from) : undefined
    const effectiveEnd = range?.to ?? range?.from

    if (effectiveStart) effectiveStart.setHours(0, 0, 0, 0)
    if (effectiveEnd) effectiveEnd.setHours(23, 59, 59, 999)

    if (effectiveStart && createdAt < effectiveStart) return false
    if (effectiveEnd && createdAt > effectiveEnd) return false
    return true
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
    const type = new Map<string, RevenueAnalysisEntry>()
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
            projectCount: 0,
            openPartnerId: sourceProject.site?.partner?.id,
        }
        partnerEntry.revenue += fee
        partnerEntry.projectCount = (partnerEntry.projectCount || 0) + 1
        partner.set(partnerId, partnerEntry)

        const domainEntry = domain.get(domainId) || {
            key: String(domainId),
            label: domainLabel,
            revenue: 0,
            projectCount: 0,
            openSiteId: sourceProject.site?.id || undefined,
            openPartnerId: sourceProject.site?.partner?.id || undefined,
        }
        domainEntry.revenue += fee
        domainEntry.projectCount = (domainEntry.projectCount || 0) + 1
        domain.set(String(domainId), domainEntry)

        const projectEntry = project.get(sourceProject.id) || {
            key: sourceProject.id,
            label: sourceProject.label,
            revenue: 0,
            projectCount: 1,
            openProjectId: sourceProject.id,
            openSiteId: sourceProject.site?.id || undefined,
            openPartnerId: sourceProject.site?.partner?.id || undefined,
            latestCreatedAtMs: new Date(sourceProject.createdAt).getTime(),
        }
        projectEntry.revenue += fee
        project.set(sourceProject.id, projectEntry)

        const typeKey = sourceProject.revenueType
        const typeEntry = type.get(typeKey) || {
            key: typeKey,
            label: typeKey === "recurring" ? "Recurring" : "One-Time",
            revenue: 0,
            projectCount: 0,
        }
        typeEntry.revenue += fee
        typeEntry.projectCount = (typeEntry.projectCount || 0) + 1
        type.set(typeKey, typeEntry)
    }

    return {
        totalRevenue,
        partner: toSortedRows(partner),
        domain: toSortedRows(domain),
        project: toSortedRows(project),
        type: toSortedRows(type),
    }
}

function getEntryMeta(entry: RevenueAnalysisEntry, mode: RevenueMode) {
    if (mode === "project") return null
    const count = entry.projectCount || 0
    return `${count} ${count === 1 ? "project" : "projects"}`
}

function reduceForChart(data: RevenueAnalysisEntry[], max = MAX_CHART_SEGMENTS) {
    const sorted = [...data].filter((entry) => entry.revenue > 0).sort((a, b) => b.revenue - a.revenue)
    if (sorted.length <= max) return sorted

    const kept = sorted.slice(0, max - 1)
    const otherTotal = sorted.slice(max - 1).reduce((sum, entry) => sum + entry.revenue, 0)
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
                        "inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-xs font-semibold transition-all sm:h-10 sm:text-xs sm:min-w-[148px] sm:w-auto",
                        activePresetId !== "all"
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
                            : "border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_94%,transparent)]"
                    )}
                >
                    <span className="max-w-[180px] truncate">{label}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                collisionPadding={16}
                className="w-[min(calc(100vw-2rem),392px)] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-apple)]"
            >
                <div className="flex max-h-[156px] flex-wrap gap-2 overflow-y-auto pr-1">
                    {presets.map((preset, index) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                                onSelectPreset(preset.id)
                                setOpen(false)
                            }}
                            className={cn(
                                "inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                                index === 0 ? "w-full" : "w-[calc(50%-4px)]",
                                activePresetId === preset.id
                                    ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
                                    : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                            )}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <div className="my-1.5 h-px bg-[var(--line-subtle)]" />

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
                    className="w-full rounded-[12px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_70%,var(--surface-lowest))] p-0.5 text-sm [&_[data-slot=calendar]]:![--cell-size:clamp(18px,4.2vw,22px)]"
                    classNames={{
                        root: "w-full p-0.5",
                        months: "relative w-full",
                        month: "w-full",
                        month_grid: "w-full table-fixed border-collapse",
                        weekdays: "grid w-full grid-cols-7",
                        weekday: "text-center text-xs font-medium text-[var(--text-secondary)]",
                        weeks: "w-full",
                        week: "mt-0 grid w-full grid-cols-7",
                        day: "w-full",
                        nav: "absolute inset-x-0 top-1 flex w-full items-center justify-between px-1",
                        month_caption: "flex h-5 w-full items-center justify-center px-6 text-xs",
                        button_previous: "h-4.5 w-4.5",
                        button_next: "h-4.5 w-4.5",
                    }}
                />

                <div className="mt-1.5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            onSelectPreset("all")
                            setOpen(false)
                        }}
                        className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Clear range
                    </button>
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Pick start and end date
                    </span>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function HomeRevenueDistributionChart({ sourceProjects, allServices, hourlyRate = 0 }: HomeRevenueDistributionChartProps) {
    const presets = React.useMemo(() => getLmsDatePresets(), [])
    const [period, setPeriod] = React.useState<string>("this-month")
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>(undefined)
    const [mode, setMode] = React.useState<RevenueMode>("project")
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<(Site & { partner?: { id: string; name: string } }) | null>(null)
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null)
    const [isOpeningEntity, setIsOpeningEntity] = React.useState(false)
    const [isListExpanded, setIsListExpanded] = React.useState(false)
    const [activeSegment, setActiveSegment] = React.useState<string | null>(null)
    const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null)

    React.useEffect(() => {
        setActiveSegment(null)
        setHoveredSegment(null)
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
    const highlightedSegment = hoveredSegment || activeSegment
    const visibleRows = isListExpanded ? rows : rows.slice(0, COLLAPSED_LIST_SIZE)
    const groupedStartIndex = chartData.findIndex((entry) => entry.key === "__other__")

    const getSegmentKey = React.useCallback((entryKey: string) => {
        const directIndex = chartData.findIndex((entry) => entry.key === entryKey)
        if (directIndex >= 0) return entryKey
        return groupedStartIndex >= 0 ? "__other__" : entryKey
    }, [chartData, groupedStartIndex])

    const getEntryColor = React.useCallback((entryKey: string) => {
        const segmentKey = getSegmentKey(entryKey)
        const colorIndex = chartData.findIndex((entry) => entry.key === segmentKey)
        return COLORS[Math.max(0, colorIndex) % COLORS.length]
    }, [chartData, getSegmentKey])

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

        if (mode === "type") return

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
            <section className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-6 shadow-[var(--shadow-apple)]">
                <p className="ui-text-section text-[var(--text-primary)]">Revenue Analysis</p>
                <p className="mt-4 rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_78%,transparent)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                    No revenue data available for this period.
                </p>
            </section>
        )
    }

    return (
        <section className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-[var(--shadow-apple)] sm:p-6 lg:p-8">
            <div className="mb-4 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="h-[22px] w-[5px] rounded-full bg-blue-600" />
                        <h3 className="text-[17px] font-bold text-[var(--text-primary)] tracking-tight">Revenue Analysis</h3>
                    </div>
                    <div className="hidden flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] sm:flex">
                        <span className="rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-3 py-1.5">
                            {totalCount} visible {mode === "type" ? "segments" : mode === "project" ? "projects" : `${mode}s`}
                        </span>
                    </div>
                    <div className="sm:hidden">
                        <span className="inline-flex rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                            {totalCount} {mode === "type" ? "segments" : mode === "project" ? "projects" : `${mode}s`} in view
                        </span>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
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

                    <div className="grid flex-1 grid-cols-2 gap-1 rounded-[16px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] p-1 sm:flex sm:flex-none sm:items-center">
                        {MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setMode(option.value)}
                                className={cn(
                                    "rounded-full px-3 py-1.5 text-xs font-bold tracking-tight transition-all sm:px-5 sm:py-1.5 sm:text-xs",
                                    mode === option.value
                                        ? "bg-[var(--surface-lowest)] text-blue-600 shadow-sm"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid items-center gap-4 sm:gap-6 lg:grid-cols-[minmax(260px,340px)_1fr] lg:gap-8">
                <div className="relative mx-auto flex aspect-square w-full max-w-[250px] items-center justify-center sm:max-w-[300px] lg:max-w-[320px]">
                    <div className="absolute inset-0 z-0 outline-none">
                        <ResponsiveContainer width="100%" height="100%" className="outline-none">
                            <PieChart style={{ outline: 'none' }}>
                                <Pie
                                    data={chartData}
                                    dataKey="revenue"
                                    nameKey="label"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="62%"
                                    outerRadius="86%"
                                    startAngle={90}
                                    endAngle={-270}
                                    stroke="var(--surface-lowest)"
                                    strokeWidth={4}
                                    style={{ outline: 'none' }}
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    isAnimationActive={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell 
                                            key={`${entry.key}-${index}`} 
                                            fill={COLORS[index % COLORS.length]}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`${entry.label}: ${formatCurrency(entry.revenue)}, ${((entry.revenue / totalRevenue) * 100).toFixed(1)}% of total revenue`}
                                            style={{ 
                                                cursor: "pointer", 
                                                outline: "none",
                                                opacity: highlightedSegment && highlightedSegment !== entry.key ? 0.3 : 1,
                                                transition: "opacity 0.2s" 
                                            }}
                                            onClick={() => {
                                                const newActive = activeSegment === entry.key ? null : entry.key;
                                                setActiveSegment(newActive);
                                                if (newActive && (index >= COLLAPSED_LIST_SIZE || entry.key === "__other__")) setIsListExpanded(true);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter" && event.key !== " ") return
                                                event.preventDefault()
                                                const newActive = activeSegment === entry.key ? null : entry.key
                                                setActiveSegment(newActive)
                                                if (newActive && (index >= COLLAPSED_LIST_SIZE || entry.key === "__other__")) setIsListExpanded(true)
                                            }}
                                            onMouseEnter={() => setHoveredSegment(entry.key)}
                                            onMouseLeave={() => setHoveredSegment(null)}
                                            onFocus={() => setHoveredSegment(entry.key)}
                                            onBlur={() => setHoveredSegment(null)}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => formatCurrency(Number(value))}
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "1px solid var(--line-subtle)",
                                        background: "var(--bg-surface)",
                                        boxShadow: "var(--shadow-apple)",
                                        fontSize: "12px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Central Label */}
                    <div className="relative z-10 flex flex-col items-center justify-center">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-xs">Total Revenue</p>
                        <p className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[var(--text-primary)] sm:text-[32px] lg:text-[36px]">
                            {formatCurrency(totalRevenue).replace(/[\s\u00A0]*RON/i, "")} <span className="ml-1 text-xs font-bold text-[var(--text-muted)] sm:text-xs lg:text-sm">RON</span>
                        </p>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2.5">
                    <div className="flex flex-col justify-center gap-2">
                        {visibleRows.map((entry) => {
                            const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0
                            const canOpen = (
                                mode === "project"
                                    ? Boolean(entry.openProjectId)
                                    : mode === "partner"
                                      ? Boolean(entry.openPartnerId)
                                      : mode === "domain"
                                        ? Boolean(entry.openSiteId)
                                        : false
                            )
                            const segmentKey = getSegmentKey(entry.key)
                            const dotColor = getEntryColor(entry.key)
                            const isHighlighted = highlightedSegment === segmentKey
                            const metaText = getEntryMeta(entry, mode)

                            return (
                                <button
                                    key={entry.key}
                                    type="button"
                                    onClick={() => {
                                        if (canOpen) {
                                            void openRowEntity(entry)
                                            return
                                        }
                                        setActiveSegment(activeSegment === segmentKey ? null : segmentKey)
                                    }}
                                    onMouseEnter={() => setHoveredSegment(segmentKey)}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                    onFocus={() => setHoveredSegment(segmentKey)}
                                    onBlur={() => setHoveredSegment(null)}
                                    aria-pressed={activeSegment === segmentKey}
                                    title={entry.label}
                                    className={cn(
                                        "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-[14px] border px-3.5 py-3 text-left transition-all sm:px-4",
                                        isHighlighted ? "relative z-10 border-blue-200/70 bg-[var(--surface-lowest)] shadow-md ring-2 ring-blue-500/60" : "border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)]",
                                        !isHighlighted && "group cursor-pointer hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_92%,transparent)]"
                                    )}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <span
                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: dotColor }}
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-[var(--text-primary)] transition-colors group-hover:text-blue-600 sm:text-[13px]">
                                                    {entry.label}
                                            </p>
                                            {metaText ? (
                                                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-muted)]">
                                                    {metaText}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-xs font-bold tabular-nums text-[var(--text-primary)] transition-colors group-hover:text-blue-600 sm:text-sm">
                                            {formatCurrency(entry.revenue)}
                                        </p>
                                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                                            {share.toFixed(1)}%
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    {rows.length > COLLAPSED_LIST_SIZE && (
                        <button
                            onClick={() => setIsListExpanded(!isListExpanded)}
                            className="w-full rounded-xl border border-transparent py-2 text-center text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--line-subtle)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_88%,transparent)] hover:text-[var(--text-primary)] sm:py-2.5 sm:text-xs"
                        >
                            {isListExpanded ? "Show less" : `View all ${totalCount} ${mode === "type" ? "types" : `${mode}s`}`}
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
