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

type RevenueMode = "partner" | "domain" | "project" | "type"

export type RevenueAnalysisEntry = {
    key: string
    label: string
    revenue: number
    hoursThisMonth?: number
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
    { label: "Type", value: "type" },
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
            fill="var(--text-primary)"
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
            hoursThisMonth: 0,
            projectCount: 0,
            openPartnerId: sourceProject.site?.partner?.id,
        }
        partnerEntry.revenue += fee
        partnerEntry.hoursThisMonth = (partnerEntry.hoursThisMonth || 0) + (sourceProject.hoursThisMonth || 0)
        partnerEntry.projectCount = (partnerEntry.projectCount || 0) + 1
        partner.set(partnerId, partnerEntry)

        const domainEntry = domain.get(domainId) || {
            key: String(domainId),
            label: domainLabel,
            revenue: 0,
            hoursThisMonth: 0,
            projectCount: 0,
            openSiteId: sourceProject.site?.id || undefined,
            openPartnerId: sourceProject.site?.partner?.id || undefined,
        }
        domainEntry.revenue += fee
        domainEntry.hoursThisMonth = (domainEntry.hoursThisMonth || 0) + (sourceProject.hoursThisMonth || 0)
        domainEntry.projectCount = (domainEntry.projectCount || 0) + 1
        domain.set(String(domainId), domainEntry)

        const projectEntry = project.get(sourceProject.id) || {
            key: sourceProject.id,
            label: sourceProject.label,
            revenue: 0,
            hoursThisMonth: sourceProject.hoursThisMonth || 0,
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
            hoursThisMonth: 0,
            projectCount: 0,
        }
        typeEntry.revenue += fee
        typeEntry.hoursThisMonth = (typeEntry.hoursThisMonth || 0) + (sourceProject.hoursThisMonth || 0)
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

function getEntryMeta(entry: RevenueAnalysisEntry, isOther: boolean) {
    if (isOther) return "Multiple small items"
    const hoursLabel = `${formatHours(entry.hoursThisMonth)} this month`
    if ((entry.projectCount || 0) > 1) return `${entry.projectCount} projects • ${hoursLabel}`
    return hoursLabel
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
                        "inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-all sm:h-10 sm:text-xs sm:min-w-[148px] sm:w-auto",
                        activePresetId !== "all"
                            ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
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
                                "inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
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
                    className="w-full rounded-[12px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_70%,white)] p-0.5 text-sm [&_[data-slot=calendar]]:![--cell-size:clamp(18px,4.2vw,22px)]"
                    classNames={{
                        root: "w-full p-0.5",
                        months: "relative w-full",
                        month: "w-full",
                        month_grid: "w-full table-fixed border-collapse",
                        weekdays: "grid w-full grid-cols-7",
                        weekday: "text-center text-[9px] font-medium text-[var(--text-secondary)]",
                        weeks: "w-full",
                        week: "mt-0 grid w-full grid-cols-7",
                        day: "w-full",
                        nav: "absolute inset-x-0 top-1 flex w-full items-center justify-between px-1",
                        month_caption: "flex h-5 w-full items-center justify-center px-6 text-[12px]",
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
                        className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Clear range
                    </button>
                    <span className="text-[9px] font-medium text-[var(--text-secondary)]">
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
            <section className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] p-6 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
                <p className="ui-text-section text-[var(--text-primary)]">Revenue Analysis</p>
                <p className="mt-4 rounded-[24px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_78%,transparent)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                    No revenue data available for this period.
                </p>
            </section>
        )
    }

    return (
        <section className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-6 lg:p-8">
            <div className="mb-4 flex flex-col gap-2.5 sm:mb-6 sm:gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <div className="h-[22px] w-[5px] rounded-full bg-blue-600" />
                        <h3 className="text-[17px] font-bold text-[var(--text-primary)] tracking-tight">Revenue Analysis</h3>
                    </div>
                    <div className="hidden flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)] sm:flex">
                        <span className="rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-3 py-1.5">
                            {totalCount} visible {mode === "type" ? "segments" : mode === "project" ? "projects" : `${mode}s`}
                        </span>
                        <span className="rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-3 py-1.5">
                            {dateLabel}
                        </span>
                    </div>
                    <div className="sm:hidden">
                        <span className="inline-flex rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] px-3 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                            {totalCount} {mode === "type" ? "segments" : mode === "project" ? "projects" : `${mode}s`} in view
                        </span>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[360px] lg:gap-3">
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

                    <div className="grid grid-cols-2 gap-1 rounded-[16px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] p-1 sm:flex sm:flex-wrap sm:items-center">
                        {MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setMode(option.value)}
                                className={cn(
                                    "rounded-full px-3 py-1.5 text-[10px] font-bold tracking-tight transition-all sm:px-5 sm:py-1.5 sm:text-[11px]",
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

            <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(280px,400px)_1fr] lg:gap-10">
                <div className="relative mx-auto flex aspect-square w-full max-w-[250px] items-center justify-center sm:h-[300px] sm:max-w-[320px] lg:h-[340px] lg:max-w-none">
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
                    <div className="relative z-10 flex flex-col items-center justify-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-[10px]">Total Revenue</p>
                        <p className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[var(--text-primary)] sm:text-[32px] lg:text-[36px]">
                            {formatCurrency(totalRevenue).replace(/[\s\u00A0]*RON/i, "")} <span className="ml-1 text-[11px] font-bold text-[var(--text-muted)] sm:text-[12px] lg:text-[14px]">RON</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col justify-center gap-2.5 sm:gap-3">
                        {(isListExpanded ? chartData : chartData.slice(0, 4)).map((entry, index) => {
                            const isOther = entry.key === "__other__"
                            const share = totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0

                            const originalEntry = isOther ? null : rows.find((row) => row.key === entry.key)
                            const canOpen = !isOther && (
                                mode === "project"
                                    ? Boolean(originalEntry?.openProjectId)
                                    : mode === "partner"
                                      ? Boolean(originalEntry?.openPartnerId)
                                      : mode === "domain"
                                        ? Boolean(originalEntry?.openSiteId)
                                        : false
                            )
                            const dotColor = COLORS[index]
                            const isHighlighted = activeSegment === entry.key

                            const metaText = getEntryMeta(originalEntry || entry, isOther)

                            return (
                                <button
                                    key={entry.key}
                                    type="button"
                                    onClick={() => {
                                        if (canOpen && originalEntry) void openRowEntity(originalEntry)
                                    }}
                                    disabled={!canOpen}
                                    className={cn(
                                        "flex w-full min-w-0 overflow-hidden flex-col items-start gap-2.5 rounded-[16px] px-4 py-3 text-left transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4",
                                        isHighlighted ? "relative z-10 scale-[1.02] border border-blue-200/70 bg-[var(--surface-lowest)] shadow-lg ring-2 ring-blue-500/70" : "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)]",
                                        canOpen && !isHighlighted ? "group cursor-pointer hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_92%,transparent)]" : !canOpen && !isHighlighted ? "cursor-default" : ""
                                    )}
                                >
                                    <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 sm:flex sm:w-auto sm:items-center sm:gap-4">
                                        <span
                                            className="col-start-1 row-span-2 mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0"
                                            style={{ backgroundColor: dotColor }}
                                        />
                                        <div className="col-start-2 min-w-0">
                                            <p className="truncate text-[12px] font-bold text-[var(--text-primary)] transition-colors group-hover:text-blue-600 sm:text-[13px]">
                                                    {entry.label}
                                            </p>
                                            <p className="mt-1 truncate text-[9px] font-bold text-[var(--text-muted)] sm:mt-0 sm:text-[10px]">
                                                {metaText}
                                            </p>
                                        </div>
                                        <div className="col-start-3 row-span-2 shrink-0 text-right sm:hidden">
                                            <p className="text-[12px] font-bold text-[var(--text-primary)]">
                                                {formatCurrency(entry.revenue)}
                                            </p>
                                            <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                                                {share.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="hidden w-full min-w-0 items-center justify-between gap-3 sm:flex sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:justify-start">
                                        <p className="text-[13px] font-bold text-[var(--text-primary)] transition-colors group-hover:text-blue-600 sm:text-[14px]">
                                            {formatCurrency(entry.revenue)}
                                        </p>
                                        <div className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)] sm:text-[11px]">
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
                            className="w-full rounded-xl border border-transparent py-2 text-center text-[11px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--line-subtle)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_88%,transparent)] hover:text-[var(--text-primary)] sm:py-2.5 sm:text-[12px]"
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
