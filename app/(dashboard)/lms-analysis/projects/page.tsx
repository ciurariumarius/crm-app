"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { differenceInCalendarMonths, format, isValid, parseISO } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LmsTasksDateRangeFilters } from "@/components/lms-tasks/lms-tasks-date-range-filters"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { DurationValue } from "@/components/lms-tasks/duration-value"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buildAllocationLookup, filterTasksByRange, getExecutantOptions } from "@/lib/lms-tasks/analytics"
import { getMonthKeyFromIso, getMonthLabel, listMonthKeysBetween } from "@/lib/lms-tasks/date-utils"
import { normalizeClientKey, normalizeExecutantKey } from "@/lib/lms-tasks/parsers"
import { isLmsMobileOptimizedEnabled } from "@/lib/lms-tasks/feature-flags"
import type { ServiceStatus } from "@/lib/lms-tasks/types"
import { cn } from "@/lib/utils"
import { detectLmsDatePresetId, getLmsDatePresets } from "@/lib/lms-tasks/date-presets"
import { FilterBarGroup, FilterBarRow, FilterBarShell, FilterResultsRow } from "@/components/ui/filter-bar"
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronDown, ChevronUp, Clock3, Search, Users, Waves, Workflow, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

const DEFAULT_EMPLOYEE_NAME = "Marius Ciurariu"
const PROJECTS_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

type ProjectWorkVolumeStatus = "No Work" | "Low" | "Good" | "High" | "Extra"
const WORK_VOLUME_OPTIONS: ProjectWorkVolumeStatus[] = ["No Work", "Low", "Good", "High", "Extra"]
type AgeOption = "0-3" | "3-6" | "6-12" | "12+"
const AGE_FILTER_OPTIONS: AgeOption[] = ["0-3", "3-6", "6-12", "12+"]
type ProjectSortKey = "client" | "services" | "team" | "delegatedPerson" | "firstTaskDate" | "lastTaskDate" | "myMinutes" | "teamMinutes" | "myTasks" | "avgMonthlyMinutes" | "workVolumeStatus"
type ProjectSortDirection = "asc" | "desc"

type ServiceKey = "seo" | "gads" | "fads" | "tads"
const SERVICE_FILTER_OPTIONS: Array<{ value: ServiceKey; label: string }> = [
  { value: "seo", label: "SEO" },
  { value: "gads", label: "GAds" },
  { value: "fads", label: "MAds" },
  { value: "tads", label: "TAds" },
]

const monthlyHoursChartConfig = {
  loggedHours: { label: "Logged Hours", color: "hsl(var(--primary))" },
} satisfies ChartConfig

type ProjectRow = {
  clientKey: string
  client: string
  team: string[]
  delegatedPerson: string
  firstTaskDate: string | null
  lastTaskDate: string | null
  myMinutes: number
  teamMinutes: number
  myTasks: number
  avgMonthlyMinutes: number
  workVolumeStatus: ProjectWorkVolumeStatus
  services: {
    seo: ServiceStatus
    gads: ServiceStatus
    fads: ServiceStatus
    tads: ServiceStatus
  }
  delegated: boolean
  isActive: boolean
  ageMonths: number | null
  recencyMonths: number | null
}

type HoursChartMode = "my" | "team"

function parseMaybeDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

function formatDateLabel(value: string | null) {
  const parsed = parseMaybeDate(value)
  if (!parsed) return "-"
  return format(parsed, "dd.MM.yyyy")
}

function getServiceBadgeClass(status: ServiceStatus) {
  if (status === "Active") return "border-emerald-500 bg-emerald-100 text-emerald-900 shadow-sm"
  if (status === "Inactive") return "border-slate-400 bg-slate-100 text-slate-700"
  if (status === "Stopped") return "border-rose-500 bg-rose-100 text-rose-900"
  return "border-slate-200 bg-white text-slate-400"
}

function getBucketByMonths(months: number | null): AgeOption | "unknown" {
  if (months == null || !Number.isFinite(months)) return "unknown"
  if (months < 3) return "0-3"
  if (months < 6) return "3-6"
  if (months < 12) return "6-12"
  return "12+"
}

function getMonthsDiff(baseIso: string, targetIso: string | null) {
  const base = parseMaybeDate(baseIso)
  const target = parseMaybeDate(targetIso)
  if (!base || !target) return null
  return Math.max(0, differenceInCalendarMonths(base, target))
}

function formatShortName(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return "Unassigned"
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || "Unassigned"
  const first = parts[0]
  const secondInitial = parts[1]?.[0] ? `${parts[1][0]}.` : ""
  return `${first} ${secondInitial}`.trim()
}

function isInternalClient(client: string) {
  const normalized = client.toLowerCase()
  return normalized.includes("[intern]") || normalized.includes("internal")
}

const WORK_VOLUME_SORT_ORDER: Record<ProjectWorkVolumeStatus, number> = {
  "No Work": 0,
  Low: 1,
  Good: 2,
  High: 3,
  Extra: 4,
}

function calculateProjectWorkVolumeStatus(avgMonthlyMinutes: number, hasTasks: boolean, assignedToSelected: boolean): ProjectWorkVolumeStatus {
  if (assignedToSelected && !hasTasks) return "No Work"
  if (hasTasks && !assignedToSelected) return "Extra"
  if (avgMonthlyMinutes < 20) return "Low"
  if (avgMonthlyMinutes <= 40) return "Good"
  return "High"
}

type MultiSelectOption<T extends string> = {
  value: T
  label: string
}

function FilterMultiSelectDropdown<T extends string>({
  label,
  options,
  selectedValues,
  onToggleValue,
  onClear,
}: {
  label: string
  options: MultiSelectOption<T>[]
  selectedValues: T[]
  onToggleValue: (value: T) => void
  onClear: () => void
}) {
  const triggerLabel = selectedValues.length > 0 ? `${label} (${selectedValues.length})` : label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-1 rounded-lg border pl-2.5 pr-2 text-xs font-semibold outline-none",
            selectedValues.length > 0
              ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
              : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]"
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onToggleValue(option.value)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {selectedValues.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onClear()
              }}
            >
              Clear {label.toLowerCase()}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function LmsAnalysisProjectsPage() {
  const mobileOptimized = isLmsMobileOptimizedEnabled()
  const { ready, data } = useLmsTasksData()
  const { start, end } = useLmsDateRange()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const employeeParam = searchParams.get("employee")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const period = searchParams.get("period")
  const datePresets = React.useMemo(() => getLmsDatePresets(), [])
  const activeDatePresetId = detectLmsDatePresetId(from, to, period)

  const executantOptions = React.useMemo(
    () => getExecutantOptions(data.tasks, data.allocations),
    [data.allocations, data.tasks]
  )

  const setQueryParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const defaultEmployeeOption = React.useMemo(() => {
    const normalizedTarget = normalizeExecutantKey(DEFAULT_EMPLOYEE_NAME)
    return executantOptions.find((option) => normalizeExecutantKey(option) === normalizedTarget) ?? null
  }, [executantOptions])

  const selectedEmployee = React.useMemo(() => {
    if (employeeParam) return employeeParam
    return defaultEmployeeOption ?? DEFAULT_EMPLOYEE_NAME
  }, [defaultEmployeeOption, employeeParam])

  const [search, setSearch] = React.useState("")
  const [activeOnly, setActiveOnly] = React.useState(false)
  const [volumeFilters, setVolumeFilters] = React.useState<ProjectWorkVolumeStatus[]>([])
  const [ageFilters, setAgeFilters] = React.useState<AgeOption[]>([])
  const [recentFilters, setRecentFilters] = React.useState<AgeOption[]>([])
  const [serviceFilters, setServiceFilters] = React.useState<ServiceKey[]>([])
  const [projectsPage, setProjectsPage] = React.useState(1)
  const [projectsPageSize, setProjectsPageSize] = React.useState<number>(50)
  const [projectsSortKey, setProjectsSortKey] = React.useState<ProjectSortKey>("myMinutes")
  const [projectsSortDirection, setProjectsSortDirection] = React.useState<ProjectSortDirection>("desc")
  const [isCalcGuideOpen, setIsCalcGuideOpen] = React.useState(false)
  const [hoursChartTarget, setHoursChartTarget] = React.useState<{ client: string; clientKey: string; mode: HoursChartMode } | null>(null)

  const toggleFilterValue = React.useCallback(<T extends string>(value: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]))
  }, [])

  const rows = React.useMemo<ProjectRow[]>(() => {
    const selectedEmployeeKey = normalizeExecutantKey(selectedEmployee)
    const rangeTasks = filterTasksByRange(data.tasks, start, end)
    const allocationByClient = buildAllocationLookup(data.allocations)
    const groupedTasks = new Map<string, typeof rangeTasks>()

    for (const task of rangeTasks) {
      const key = normalizeClientKey(task.client)
      const existing = groupedTasks.get(key) ?? []
      existing.push(task)
      groupedTasks.set(key, existing)
    }

    const clientKeys = new Set<string>()
    for (const task of rangeTasks) clientKeys.add(normalizeClientKey(task.client))
    for (const allocation of data.allocations) {
      if (normalizeExecutantKey(allocation.specialist) === selectedEmployeeKey) {
        clientKeys.add(normalizeClientKey(allocation.client))
      }
    }

    const monthsInRange = Math.max(1, listMonthKeysBetween(start, end).length)

    const built = Array.from(clientKeys).map((key) => {
      const tasksForClient = groupedTasks.get(key) ?? []
      const allocation = allocationByClient.get(key)
      const client = tasksForClient[0]?.client || allocation?.client || "Unknown Client"
      const teamMinutes = tasksForClient.reduce((sum, task) => sum + task.durationMinutes, 0)
      const myTasks = tasksForClient.filter((task) => normalizeExecutantKey(task.executant) === selectedEmployeeKey)
      const myMinutes = myTasks.reduce((sum, task) => sum + task.durationMinutes, 0)
      const myTasksCount = myTasks.length
      const avgMonthlyMinutes = myMinutes / monthsInRange

      const allDates = tasksForClient.map((task) => task.date).filter((value): value is string => Boolean(value))
      const firstTaskDate = allDates.length > 0 ? [...allDates].sort((a, b) => a.localeCompare(b))[0] : null
      const lastTaskDate = allDates.length > 0 ? [...allDates].sort((a, b) => b.localeCompare(a))[0] : null

      const contributors = new Map<string, number>()
      for (const task of tasksForClient) {
        contributors.set(task.executant, (contributors.get(task.executant) ?? 0) + task.durationMinutes)
      }

      const team: string[] = []
      if (allocation?.specialist) team.push(allocation.specialist)
      for (const [name] of Array.from(contributors.entries()).sort((a, b) => b[1] - a[1])) {
        if (!team.some((member) => normalizeExecutantKey(member) === normalizeExecutantKey(name))) {
          team.push(name)
        }
      }

      const assignedToSelected =
        allocation?.specialist ? normalizeExecutantKey(allocation.specialist) === selectedEmployeeKey : false
      const workVolumeStatus = calculateProjectWorkVolumeStatus(avgMonthlyMinutes, myTasksCount > 0, assignedToSelected)

      const services = {
        seo: allocation?.seo ?? "-",
        gads: allocation?.gads ?? "-",
        fads: allocation?.fads ?? "-",
        tads: allocation?.tads ?? "-",
      }

      const isActive = services.seo === "Active" || services.gads === "Active" || services.fads === "Active" || services.tads === "Active"

      return {
        clientKey: key,
        client,
        team: team.slice(0, 4),
        delegatedPerson: allocation?.specialist || "Unassigned",
        firstTaskDate,
        lastTaskDate,
        myMinutes,
        teamMinutes,
        myTasks: myTasksCount,
        avgMonthlyMinutes,
        workVolumeStatus,
        services,
        delegated: assignedToSelected,
        isActive,
        ageMonths: getMonthsDiff(end, firstTaskDate),
        recencyMonths: getMonthsDiff(end, lastTaskDate),
      }
    })

    return built.sort((a, b) => {
      if (b.myMinutes !== a.myMinutes) return b.myMinutes - a.myMinutes
      if (b.teamMinutes !== a.teamMinutes) return b.teamMinutes - a.teamMinutes
      return a.client.localeCompare(b.client)
    })
  }, [data.allocations, data.tasks, end, selectedEmployee, start])

  const filteredRows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const selectedEmployeeKey = normalizeExecutantKey(selectedEmployee)
    return rows.filter((row) => {
      if (needle && !row.client.toLowerCase().includes(needle)) return false

      const matchesSelectedTeamMember = row.team.some(
        (member) => normalizeExecutantKey(member) === selectedEmployeeKey
      )
      if (!matchesSelectedTeamMember) return false

      if (activeOnly && !row.isActive) return false
      if (volumeFilters.length > 0 && !volumeFilters.includes(row.workVolumeStatus)) return false

      if (serviceFilters.length > 0) {
        const hasAnySelectedService = serviceFilters.some((service) => row.services[service] === "Active")
        if (!hasAnySelectedService) return false
      }

      const ageBucket = getBucketByMonths(row.ageMonths)
      if (ageFilters.length > 0 && (ageBucket === "unknown" || !ageFilters.includes(ageBucket))) return false

      const recentBucket = getBucketByMonths(row.recencyMonths)
      if (recentFilters.length > 0 && (recentBucket === "unknown" || !recentFilters.includes(recentBucket))) return false
      return true
    })
  }, [ageFilters, activeOnly, recentFilters, rows, search, selectedEmployee, serviceFilters, volumeFilters])

  const clearFilters = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("employee")
    next.delete("from")
    next.delete("to")
    next.set("period", "all")
    router.replace(`${pathname}?${next.toString()}`)

    setSearch("")
    setActiveOnly(false)
    setVolumeFilters([])
    setAgeFilters([])
    setRecentFilters([])
    setServiceFilters([])
  }, [pathname, router, searchParams])

  const activeFilters = React.useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = []

    if (search.trim()) {
      filters.push({ id: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") })
    }

    if (selectedEmployee) {
      filters.push({ id: "employee", label: `Employee: ${selectedEmployee}`, onRemove: () => setQueryParams({ employee: null }) })
    }

    if (activeDatePresetId === "custom") {
      const fromLabel = formatDateLabel(from)
      const toLabel = formatDateLabel(to)
      filters.push({
        id: "date",
        label: `Date: ${fromLabel} - ${toLabel}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams.toString())
          next.delete("from")
          next.delete("to")
          next.set("period", "all")
          router.replace(`${pathname}?${next.toString()}`)
        },
      })
    } else if (activeDatePresetId !== "all") {
      const preset = datePresets.find((item) => item.id === activeDatePresetId)
      if (preset) {
        filters.push({
          id: "date",
          label: `Date: ${preset.label}`,
          onRemove: () => {
            const next = new URLSearchParams(searchParams.toString())
            next.delete("from")
            next.delete("to")
            next.set("period", "all")
            router.replace(`${pathname}?${next.toString()}`)
          },
        })
      }
    }

    if (activeOnly) filters.push({ id: "active", label: "Active: Only", onRemove: () => setActiveOnly(false) })

    for (const volume of volumeFilters) {
      filters.push({
        id: `volume-${volume}`,
        label: `Volume: ${volume}`,
        onRemove: () => setVolumeFilters((current) => current.filter((entry) => entry !== volume)),
      })
    }

    for (const service of serviceFilters) {
      const serviceLabel = SERVICE_FILTER_OPTIONS.find((option) => option.value === service)?.label ?? service.toUpperCase()
      filters.push({
        id: `service-${service}`,
        label: `Service: ${serviceLabel}`,
        onRemove: () => setServiceFilters((current) => current.filter((entry) => entry !== service)),
      })
    }

    for (const age of ageFilters) {
      filters.push({
        id: `age-${age}`,
        label: `Age: ${age} mo`,
        onRemove: () => setAgeFilters((current) => current.filter((entry) => entry !== age)),
      })
    }

    for (const recent of recentFilters) {
      filters.push({
        id: `recent-${recent}`,
        label: `Recent: ${recent} mo`,
        onRemove: () => setRecentFilters((current) => current.filter((entry) => entry !== recent)),
      })
    }

    return filters
  }, [
    activeDatePresetId,
    activeOnly,
    ageFilters,
    datePresets,
    from,
    pathname,
    recentFilters,
    router,
    search,
    searchParams,
    selectedEmployee,
    serviceFilters,
    setQueryParams,
    to,
    volumeFilters,
  ])

  const sortedRows = React.useMemo(() => {
    const direction = projectsSortDirection === "asc" ? 1 : -1
    const rowsToSort = [...filteredRows]

    rowsToSort.sort((a, b) => {
      if (serviceFilters.length > 0) {
        const aAllFourActive =
          a.services.seo === "Active" &&
          a.services.gads === "Active" &&
          a.services.fads === "Active" &&
          a.services.tads === "Active"
        const bAllFourActive =
          b.services.seo === "Active" &&
          b.services.gads === "Active" &&
          b.services.fads === "Active" &&
          b.services.tads === "Active"
        if (aAllFourActive !== bAllFourActive) return aAllFourActive ? -1 : 1
      }

      let result = 0

      if (projectsSortKey === "client") {
        result = a.client.localeCompare(b.client)
      } else if (projectsSortKey === "services") {
        const aActiveCount = [a.services.seo, a.services.gads, a.services.fads, a.services.tads].filter((status) => status === "Active").length
        const bActiveCount = [b.services.seo, b.services.gads, b.services.fads, b.services.tads].filter((status) => status === "Active").length
        if (aActiveCount !== bActiveCount) result = aActiveCount - bActiveCount
        else {
          const aSignature = `${a.services.seo}-${a.services.gads}-${a.services.fads}-${a.services.tads}`
          const bSignature = `${b.services.seo}-${b.services.gads}-${b.services.fads}-${b.services.tads}`
          result = aSignature.localeCompare(bSignature)
        }
      } else if (projectsSortKey === "team") {
        result = (a.team[0] ?? "").localeCompare(b.team[0] ?? "")
      } else if (projectsSortKey === "delegatedPerson") {
        result = a.delegatedPerson.localeCompare(b.delegatedPerson)
      } else if (projectsSortKey === "firstTaskDate") {
        result = (a.firstTaskDate ?? "").localeCompare(b.firstTaskDate ?? "")
      } else if (projectsSortKey === "lastTaskDate") {
        result = (a.lastTaskDate ?? "").localeCompare(b.lastTaskDate ?? "")
      } else if (projectsSortKey === "myMinutes") {
        result = a.myMinutes - b.myMinutes
      } else if (projectsSortKey === "teamMinutes") {
        result = a.teamMinutes - b.teamMinutes
      } else if (projectsSortKey === "myTasks") {
        result = a.myTasks - b.myTasks
      } else if (projectsSortKey === "avgMonthlyMinutes") {
        result = a.avgMonthlyMinutes - b.avgMonthlyMinutes
      } else if (projectsSortKey === "workVolumeStatus") {
        result = WORK_VOLUME_SORT_ORDER[a.workVolumeStatus] - WORK_VOLUME_SORT_ORDER[b.workVolumeStatus]
      }

      if (result === 0) return a.client.localeCompare(b.client) * direction
      return result * direction
    })

    return rowsToSort
  }, [filteredRows, projectsSortDirection, projectsSortKey, serviceFilters])

  const projectsTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(sortedRows.length / projectsPageSize)),
    [projectsPageSize, sortedRows.length]
  )

  const pagedRows = React.useMemo(() => {
    const startIndex = (projectsPage - 1) * projectsPageSize
    return sortedRows.slice(startIndex, startIndex + projectsPageSize)
  }, [projectsPage, projectsPageSize, sortedRows])

  const totalProjectsDelegated = React.useMemo(
    () => filteredRows.filter((row) => row.delegated && row.isActive).length,
    [filteredRows]
  )

  const totalActiveServices = React.useMemo(
    () =>
      filteredRows.reduce((sum, row) => {
        let activeCount = 0
        if (row.services.seo === "Active") activeCount += 1
        if (row.services.gads === "Active") activeCount += 1
        if (row.services.fads === "Active") activeCount += 1
        if (row.services.tads === "Active") activeCount += 1
        return sum + activeCount
      }, 0),
    [filteredRows]
  )

  const averageMyMinutesPerProject = React.useMemo(() => {
    const nonInternalRows = filteredRows.filter((row) => !isInternalClient(row.client))
    if (nonInternalRows.length === 0) return 0
    const totalMyMinutes = nonInternalRows.reduce((sum, row) => sum + row.myMinutes, 0)
    return totalMyMinutes / nonInternalRows.length
  }, [filteredRows])

  const monthlyHoursChartRows = React.useMemo(() => {
    if (!hoursChartTarget) return []

    const selectedEmployeeKey = normalizeExecutantKey(selectedEmployee)
    const monthKeys = listMonthKeysBetween(start, end)
    const minuteByMonth = new Map<string, number>()

    for (const task of data.tasks) {
      if (!task.date || task.date < start || task.date > end) continue
      if (normalizeClientKey(task.client) !== hoursChartTarget.clientKey) continue
      if (hoursChartTarget.mode === "my" && normalizeExecutantKey(task.executant) !== selectedEmployeeKey) continue

      const monthKey = getMonthKeyFromIso(task.date)
      minuteByMonth.set(monthKey, (minuteByMonth.get(monthKey) ?? 0) + task.durationMinutes)
    }

    return monthKeys.map((monthKey) => {
      const loggedMinutes = minuteByMonth.get(monthKey) ?? 0
      return {
        monthKey,
        monthLabel: getMonthLabel(monthKey),
        loggedMinutes,
        loggedHours: Number((loggedMinutes / 60).toFixed(2)),
      }
    })
  }, [data.tasks, end, hoursChartTarget, selectedEmployee, start])

  const hoursChartTitle = hoursChartTarget?.mode === "team" ? "Team Hours Timeline" : "My Hours Timeline"
  const hoursChartDescription = React.useMemo(() => {
    if (!hoursChartTarget) return "Month-by-month hours in selected range."
    const scopeLabel = hoursChartTarget.mode === "team" ? "Team" : selectedEmployee
    return `${hoursChartTarget.client} · ${scopeLabel} · ${start} to ${end}`
  }, [end, hoursChartTarget, selectedEmployee, start])

  const monthlyHoursTotalMinutes = React.useMemo(
    () => monthlyHoursChartRows.reduce((sum, row) => sum + row.loggedMinutes, 0),
    [monthlyHoursChartRows]
  )

  const handleProjectsSort = React.useCallback(
    (key: ProjectSortKey) => {
      setProjectsPage(1)
      setProjectsSortKey((previousKey) => {
        if (previousKey === key) {
          setProjectsSortDirection((previousDirection) => (previousDirection === "asc" ? "desc" : "asc"))
          return previousKey
        }

        setProjectsSortDirection(
          key === "client" || key === "team" || key === "delegatedPerson" || key === "firstTaskDate" || key === "lastTaskDate"
            ? "asc"
            : "desc"
        )
        return key
      })
    },
    [setProjectsPage, setProjectsSortDirection, setProjectsSortKey]
  )

  const getSortIcon = React.useCallback(
    (key: ProjectSortKey) => {
      if (projectsSortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      if (projectsSortDirection === "asc") return <ArrowUp className="h-3.5 w-3.5" />
      return <ArrowDown className="h-3.5 w-3.5" />
    },
    [projectsSortDirection, projectsSortKey]
  )

  React.useEffect(() => {
    setProjectsPage(1)
  }, [projectsPageSize, search, selectedEmployee, activeOnly, volumeFilters, serviceFilters, ageFilters, recentFilters, from, to, period])

  React.useEffect(() => {
    if (projectsPage > projectsTotalPages) setProjectsPage(projectsTotalPages)
  }, [projectsPage, projectsTotalPages])

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.tasks.length === 0 && data.allocations.length === 0) {
    return <LmsTasksEmptyState />
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <FilterBarShell className="rounded-2xl border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-4 shadow-none">
          <FilterBarRow wrap className="w-full min-w-0 items-center gap-2 md:gap-2">
              <FilterBarGroup wrap className="w-full items-center gap-2 md:gap-2">
                <div className="inline-flex h-10 min-w-[180px] flex-[2_1_240px] items-center gap-2 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-3">
                  <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search client..."
                    aria-label="Search client"
                    className="h-8 w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <div className="relative flex-1 min-w-[130px]">
                  <select
                    value={selectedEmployee}
                    onChange={(event) => setQueryParams({ employee: event.target.value })}
                    aria-label="Employee filter"
                    className="h-10 w-full appearance-none rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] pl-2.5 pr-8 text-xs font-semibold text-[var(--text-secondary)] outline-none"
                  >
                    {executantOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    {!executantOptions.includes(selectedEmployee) ? (
                      <option value={selectedEmployee}>{selectedEmployee}</option>
                    ) : null}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" />
                </div>
                <label
                  className={cn(
                    "inline-flex h-10 min-w-[120px] flex-1 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                    activeOnly
                      ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                      : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]"
                  )}
                >
                  <Checkbox
                    checked={activeOnly}
                    onCheckedChange={(checked) => setActiveOnly(Boolean(checked))}
                    aria-label="Show only active projects"
                    className="border-[var(--line-subtle)] data-[state=checked]:border-[var(--brand-primary)] data-[state=checked]:bg-[var(--brand-primary)]"
                  />
                  <span className="truncate">Active only</span>
                </label>
                <div className="flex-1 min-w-[120px]">
                  <FilterMultiSelectDropdown
                    label="Volume"
                    options={WORK_VOLUME_OPTIONS.map((status) => ({ value: status, label: status }))}
                    selectedValues={volumeFilters}
                    onToggleValue={(value) => toggleFilterValue(value, setVolumeFilters)}
                    onClear={() => setVolumeFilters([])}
                  />
                </div>
                <div className="flex-1 min-w-[110px]">
                  <FilterMultiSelectDropdown
                    label="Service"
                    options={SERVICE_FILTER_OPTIONS}
                    selectedValues={serviceFilters}
                    onToggleValue={(value) => toggleFilterValue(value, setServiceFilters)}
                    onClear={() => setServiceFilters([])}
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <FilterMultiSelectDropdown
                    label="Age"
                    options={AGE_FILTER_OPTIONS.map((value) => ({ value, label: `${value} mo` }))}
                    selectedValues={ageFilters}
                    onToggleValue={(value) => toggleFilterValue(value, setAgeFilters)}
                    onClear={() => setAgeFilters([])}
                  />
                </div>
                <div className="flex-1 min-w-[115px]">
                  <FilterMultiSelectDropdown
                    label="Recent"
                    options={AGE_FILTER_OPTIONS.map((value) => ({ value, label: `${value} mo` }))}
                    selectedValues={recentFilters}
                    onToggleValue={(value) => toggleFilterValue(value, setRecentFilters)}
                    onClear={() => setRecentFilters([])}
                  />
                </div>
                <div className="min-w-[130px] flex-1 md:ml-auto md:max-w-[220px]">
                  <LmsTasksDateRangeFilters />
                </div>
              </FilterBarGroup>
          </FilterBarRow>
        </FilterBarShell>

        <FilterResultsRow className="justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{filteredRows.length} Results found</p>
            {activeFilters.length > 0 && <span className="text-[var(--line-subtle)]">|</span>}
            {activeFilters.map((filter) => (
              <span
                key={filter.id}
                className="inline-flex h-7 items-center rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,white)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_12%,white)] px-2.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--brand-primary)]"
              >
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={filter.onRemove}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--brand-primary)]/80 transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand-cyan)_20%,white)] hover:text-[var(--brand-primary)]"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {activeFilters.length > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 transition-colors hover:text-slate-800"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </FilterResultsRow>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Total Projects Delegated</CardDescription>
            <CardTitle className="text-2xl">{totalProjectsDelegated}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[var(--text-secondary)]">
            Active projects assigned to {selectedEmployee}.
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Total Active Services</CardDescription>
            <CardTitle className="text-2xl">{totalActiveServices}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[var(--text-secondary)]">
            Counts each active service (SE, GA, FB, TT) per filtered project.
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Avg Time / Domain</CardDescription>
            <CardTitle className="text-2xl">
              <DurationValue minutes={averageMyMinutesPerProject} />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[var(--text-secondary)]">
            Average selected employee time per filtered domain/project.
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Projects Table</CardTitle>
          <CardDescription>My contribution vs team workload per client.</CardDescription>
        </CardHeader>
        <CardContent>
          {mobileOptimized ? (
            <div className="space-y-3 pb-1 md:hidden">
              {pagedRows.map((row) => (
                <article key={`mobile-${row.clientKey}`} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{row.client}</p>
                    <Badge
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
                        row.workVolumeStatus === "No Work" && "border-slate-300 bg-slate-100 text-slate-700",
                        row.workVolumeStatus === "Low" && "border-amber-300 bg-amber-50 text-amber-700",
                        row.workVolumeStatus === "Good" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                        row.workVolumeStatus === "High" && "border-rose-300 bg-rose-50 text-rose-700",
                        row.workVolumeStatus === "Extra" && "border-violet-300 bg-violet-50 text-violet-700"
                      )}
                    >
                      {row.workVolumeStatus}
                    </Badge>
                  </div>

                  <div className="mt-2 flex items-center gap-1">
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black", getServiceBadgeClass(row.services.seo))}>SE</span>
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black", getServiceBadgeClass(row.services.gads))}>GA</span>
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black", getServiceBadgeClass(row.services.fads))}>FB</span>
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black", getServiceBadgeClass(row.services.tads))}>TT</span>
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <p className="line-clamp-1">
                      Team:{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {row.team.map((member) => formatShortName(member)).join(", ") || "-"}
                      </span>
                    </p>
                    <p>
                      Delegated: <span className="font-semibold text-[var(--text-primary)]">{formatShortName(row.delegatedPerson)}</span>
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-[var(--bg-surface-soft)] px-2 py-1.5">
                      <p className="text-[var(--text-muted)]">My Hrs</p>
                      <button
                        type="button"
                        onClick={() => setHoursChartTarget({ client: row.client, clientKey: row.clientKey, mode: "my" })}
                        className="mt-0.5 inline-flex font-semibold text-[var(--text-primary)]"
                      >
                        <DurationValue minutes={row.myMinutes} className="text-sm" />
                      </button>
                    </div>
                    <div className="rounded-md bg-[var(--bg-surface-soft)] px-2 py-1.5">
                      <p className="text-[var(--text-muted)]">Team Hrs</p>
                      <button
                        type="button"
                        onClick={() => setHoursChartTarget({ client: row.client, clientKey: row.clientKey, mode: "team" })}
                        className="mt-0.5 inline-flex font-semibold text-[var(--text-primary)]"
                      >
                        <DurationValue minutes={row.teamMinutes} className="text-sm" />
                      </button>
                    </div>
                    <div className="rounded-md bg-[var(--bg-surface-soft)] px-2 py-1.5">
                      <p className="text-[var(--text-muted)]">Tasks</p>
                      <p className="mt-0.5 font-semibold text-[var(--text-primary)]">{row.myTasks}</p>
                    </div>
                    <div className="rounded-md bg-[var(--bg-surface-soft)] px-2 py-1.5">
                      <p className="text-[var(--text-muted)]">Avg Vol</p>
                      <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                        <DurationValue minutes={row.avgMonthlyMinutes} className="text-sm" />
                        <span className="ml-1 text-[10px] font-medium text-[var(--text-secondary)]">/mo</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>1st: {formatDateLabel(row.firstTaskDate)}</span>
                    <span>Last: {formatDateLabel(row.lastTaskDate)}</span>
                  </div>
                </article>
              ))}

              {filteredRows.length === 0 ? (
                <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
                  No projects match current filters.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={cn(mobileOptimized && "hidden md:block")}>
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[13%]">
                  <button type="button" onClick={() => handleProjectsSort("client")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <Workflow className="h-4 w-4" />Client {getSortIcon("client")}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <button type="button" onClick={() => handleProjectsSort("services")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <Waves className="h-4 w-4" />Services {getSortIcon("services")}
                  </button>
                </TableHead>
                <TableHead className="w-[12%]">
                  <button type="button" onClick={() => handleProjectsSort("team")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <Users className="h-4 w-4" />Team {getSortIcon("team")}
                  </button>
                </TableHead>
                <TableHead className="w-[7%]">
                  <button type="button" onClick={() => handleProjectsSort("delegatedPerson")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    Delegated {getSortIcon("delegatedPerson")}
                  </button>
                </TableHead>
                <TableHead className="w-[6%]">
                  <button type="button" onClick={() => handleProjectsSort("firstTaskDate")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <CalendarDays className="h-4 w-4" />1st {getSortIcon("firstTaskDate")}
                  </button>
                </TableHead>
                <TableHead className="w-[6%]">
                  <button type="button" onClick={() => handleProjectsSort("lastTaskDate")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <CalendarDays className="h-4 w-4" />Last {getSortIcon("lastTaskDate")}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <button type="button" onClick={() => handleProjectsSort("myMinutes")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    <Clock3 className="h-4 w-4" />My Hrs {getSortIcon("myMinutes")}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <button type="button" onClick={() => handleProjectsSort("teamMinutes")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    Team Hrs {getSortIcon("teamMinutes")}
                  </button>
                </TableHead>
                <TableHead className="w-[6%]">
                  <button type="button" onClick={() => handleProjectsSort("myTasks")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    My Tasks {getSortIcon("myTasks")}
                  </button>
                </TableHead>
                <TableHead className="w-[6%]">
                  <button type="button" onClick={() => handleProjectsSort("avgMonthlyMinutes")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    Avg Vol {getSortIcon("avgMonthlyMinutes")}
                  </button>
                </TableHead>
                <TableHead className="w-[10%]">
                  <button type="button" onClick={() => handleProjectsSort("workVolumeStatus")} className="inline-flex items-center gap-1 whitespace-nowrap text-left">
                    Volume {getSortIcon("workVolumeStatus")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow key={row.clientKey}>
                  <TableCell className="truncate text-sm font-semibold" title={row.client}>{row.client}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black tracking-[0.03em]", getServiceBadgeClass(row.services.seo))}
                        title={`SEO: ${row.services.seo}`}
                      >
                        SE
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black tracking-[0.03em]", getServiceBadgeClass(row.services.gads))}
                        title={`GAds: ${row.services.gads}`}
                      >
                        GA
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black tracking-[0.03em]", getServiceBadgeClass(row.services.fads))}
                        title={`FAds: ${row.services.fads}`}
                      >
                        FB
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-black tracking-[0.03em]", getServiceBadgeClass(row.services.tads))}
                        title={`TAds: ${row.services.tads}`}
                      >
                        TT
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {row.team.length === 0 ? "-" : (
                      <div className="space-y-0.5">
                        {row.team.map((member) => (
                          <p
                            key={`${row.client}-${member}`}
                            className={cn(
                              "truncate rounded px-1.5 py-0.5 text-sm font-medium",
                              normalizeExecutantKey(member) === normalizeExecutantKey(selectedEmployee)
                                ? "bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                                : "text-[var(--text-primary)]"
                            )}
                            title={member}
                          >
                            {formatShortName(member)}
                          </p>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate" title={row.delegatedPerson}>
                    <span
                      className={cn(
                        "inline-flex rounded px-1 py-0.5 text-sm font-medium",
                        normalizeExecutantKey(row.delegatedPerson) === normalizeExecutantKey(selectedEmployee)
                          ? "bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                          : "text-[var(--text-primary)]"
                      )}
                    >
                      {formatShortName(row.delegatedPerson)}
                    </span>
                  </TableCell>
                  <TableCell>{formatDateLabel(row.firstTaskDate)}</TableCell>
                  <TableCell>{formatDateLabel(row.lastTaskDate)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setHoursChartTarget({ client: row.client, clientKey: row.clientKey, mode: "my" })}
                      className="inline-flex rounded px-1 py-0.5 transition-colors hover:bg-[var(--bg-surface-soft)]"
                      title="View monthly breakdown"
                    >
                      <DurationValue minutes={row.myMinutes} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setHoursChartTarget({ client: row.client, clientKey: row.clientKey, mode: "team" })}
                      className="inline-flex rounded px-1 py-0.5 transition-colors hover:bg-[var(--bg-surface-soft)]"
                      title="View team monthly breakdown"
                    >
                      <DurationValue minutes={row.teamMinutes} />
                    </button>
                  </TableCell>
                  <TableCell>{row.myTasks}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <DurationValue minutes={row.avgMonthlyMinutes} />
                      <span className="text-xs text-[var(--text-secondary)]">/mo</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                        row.workVolumeStatus === "No Work" && "border-slate-300 bg-slate-100 text-slate-700",
                        row.workVolumeStatus === "Low" && "border-amber-300 bg-amber-50 text-amber-700",
                        row.workVolumeStatus === "Good" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                        row.workVolumeStatus === "High" && "border-rose-300 bg-rose-50 text-rose-700",
                        row.workVolumeStatus === "Extra" && "border-violet-300 bg-violet-50 text-violet-700"
                      )}
                    >
                      {row.workVolumeStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-[var(--text-secondary)]">
                    No projects match current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
          {filteredRows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Page {projectsPage} of {projectsTotalPages} · {filteredRows.length} total rows
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  Results
                  <div className="relative">
                    <select
                      value={projectsPageSize}
                      onChange={(event) => setProjectsPageSize(Number(event.target.value))}
                      className="h-9 appearance-none rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] pl-2 pr-7 text-xs font-semibold text-[var(--text-primary)] outline-none"
                      aria-label="Rows per page"
                    >
                      {PROJECTS_PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size} / page
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setProjectsPage((current) => Math.max(1, current - 1))}
                  disabled={projectsPage <= 1}
                  className="inline-flex h-9 items-center rounded-md border border-[var(--line-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsPage((current) => Math.min(projectsTotalPages, current + 1))}
                  disabled={projectsPage >= projectsTotalPages}
                  className="inline-flex h-9 items-center rounded-md border border-[var(--line-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader className="cursor-pointer select-none" onClick={() => setIsCalcGuideOpen((previous) => !previous)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Column Calculation Guide</CardTitle>
              <CardDescription>How Avg Vol and Work Volume are calculated in this table.</CardDescription>
            </div>
            {isCalcGuideOpen ? (
              <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
            )}
          </div>
        </CardHeader>
        {isCalcGuideOpen ? (
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Avg Vol</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Avg Vol is the selected employee monthly average for each client in the selected date range.
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                Formula: Avg Vol = My Minutes / Months In Range
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                My Minutes = total minutes logged by selected employee on that client.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Work Volume</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Work Volume is derived from Avg Vol (minutes/month) using business thresholds.
              </p>
              <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                <p>No Work: delegated to selected employee but no time entries by selected employee</p>
                <p>Low: avg &lt; 20 min/mo</p>
                <p>Good: avg 20-40 min/mo</p>
                <p>High: avg &gt; 40 min/mo</p>
                <p>Extra: has work but client is assigned to another specialist</p>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Dialog open={Boolean(hoursChartTarget)} onOpenChange={(open) => !open && setHoursChartTarget(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{hoursChartTitle}</DialogTitle>
            <DialogDescription>{hoursChartDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Total In Range</p>
              <DurationValue minutes={monthlyHoursTotalMinutes} className="text-base" />
            </div>

            {monthlyHoursChartRows.some((row) => row.loggedMinutes > 0) ? (
              <ChartContainer config={monthlyHoursChartConfig} className="h-[320px] w-full">
                <BarChart data={monthlyHoursChartRows}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                  <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="loggedHours" fill="var(--color-loggedHours)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                No time entries found for this scope in the selected range.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
