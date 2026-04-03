"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { differenceInCalendarMonths, format, isValid, parseISO } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LmsTasksDateRangeFilters } from "@/components/lms-tasks/lms-tasks-date-range-filters"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { WorkVolumeBadge } from "@/components/lms-tasks/lms-tasks-badges"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import { buildAllocationLookup, calculateWorkVolumeStatus, filterTasksByRange, formatHours, getExecutantOptions } from "@/lib/lms-tasks/analytics"
import { listMonthKeysBetween } from "@/lib/lms-tasks/date-utils"
import { normalizeClientKey, normalizeExecutantKey } from "@/lib/lms-tasks/parsers"
import type { ServiceStatus, WorkVolumeStatus } from "@/lib/lms-tasks/types"
import { cn } from "@/lib/utils"
import { detectLmsDatePresetId, getLmsDatePresets } from "@/lib/lms-tasks/date-presets"
import { FilterBarGroup, FilterBarRow, FilterBarShell, FilterResultsRow } from "@/components/ui/filter-bar"
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronDown, ChevronUp, Clock3, Search, Users, Waves, Workflow, X } from "lucide-react"

const DEFAULT_EMPLOYEE_NAME = "Marius Ciurariu"
const PROJECTS_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

const WORK_VOLUME_OPTIONS: WorkVolumeStatus[] = ["No Work", "Low", "Medium", "Optimal", "High", "Extra"]
type AgeOption = "all" | "0-3" | "3-6" | "6-12" | "12+"
type ProjectSortKey = "client" | "services" | "team" | "firstTaskDate" | "lastTaskDate" | "myMinutes" | "teamMinutes" | "myTasks" | "avgMonthlyMinutes" | "workVolumeStatus"
type ProjectSortDirection = "asc" | "desc"

type ServiceKey = "seo" | "gads" | "fads" | "tads"

type ProjectRow = {
  client: string
  team: string[]
  firstTaskDate: string | null
  lastTaskDate: string | null
  myMinutes: number
  teamMinutes: number
  myTasks: number
  avgMonthlyMinutes: number
  workVolumeStatus: WorkVolumeStatus
  services: {
    seo: ServiceStatus
    gads: ServiceStatus
    fads: ServiceStatus
    tads: ServiceStatus
  }
  isActive: boolean
  ageMonths: number | null
  recencyMonths: number | null
}

function parseMaybeDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

function formatDateLabel(value: string | null) {
  const parsed = parseMaybeDate(value)
  if (!parsed) return "-"
  return format(parsed, "dd MMM yyyy")
}

function getServiceBadgeClass(status: ServiceStatus) {
  if (status === "Active") return "border-emerald-500 bg-emerald-100 text-emerald-900 shadow-sm"
  if (status === "Inactive") return "border-slate-400 bg-slate-100 text-slate-700"
  if (status === "Stopped") return "border-rose-500 bg-rose-100 text-rose-900"
  return "border-slate-200 bg-white text-slate-400"
}

function getBucketByMonths(months: number | null): Exclude<AgeOption, "all"> | "unknown" {
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

function formatHoursOrMinutes(minutes: number, precision = 1) {
  if (minutes < 60) return `${Math.round(minutes)}m`
  return formatHours(minutes, precision)
}

const WORK_VOLUME_SORT_ORDER: Record<WorkVolumeStatus, number> = {
  "No Work": 0,
  Low: 1,
  Medium: 2,
  Optimal: 3,
  High: 4,
  Extra: 5,
}

export default function LmsAnalysisProjectsPage() {
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
  const [volumeFilter, setVolumeFilter] = React.useState<WorkVolumeStatus | "all">("all")
  const [ageFilter, setAgeFilter] = React.useState<AgeOption>("all")
  const [recentFilter, setRecentFilter] = React.useState<AgeOption>("all")
  const [serviceFilter, setServiceFilter] = React.useState<ServiceKey | "all">("all")
  const [projectsPage, setProjectsPage] = React.useState(1)
  const [projectsPageSize, setProjectsPageSize] = React.useState<number>(50)
  const [projectsSortKey, setProjectsSortKey] = React.useState<ProjectSortKey>("myMinutes")
  const [projectsSortDirection, setProjectsSortDirection] = React.useState<ProjectSortDirection>("desc")
  const [isCalcGuideOpen, setIsCalcGuideOpen] = React.useState(false)

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
      const workVolumeStatus =
        myTasksCount > 0 && allocation?.specialist && !assignedToSelected
          ? "Extra"
          : calculateWorkVolumeStatus(avgMonthlyMinutes, myTasksCount > 0, Boolean(allocation))

      const services = {
        seo: allocation?.seo ?? "-",
        gads: allocation?.gads ?? "-",
        fads: allocation?.fads ?? "-",
        tads: allocation?.tads ?? "-",
      }

      const isActive = services.seo === "Active" || services.gads === "Active" || services.fads === "Active" || services.tads === "Active"

      return {
        client,
        team: team.slice(0, 4),
        firstTaskDate,
        lastTaskDate,
        myMinutes,
        teamMinutes,
        myTasks: myTasksCount,
        avgMonthlyMinutes,
        workVolumeStatus,
        services,
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
    return rows.filter((row) => {
      if (needle && !row.client.toLowerCase().includes(needle)) return false
      if (activeOnly && !row.isActive) return false
      if (volumeFilter !== "all" && row.workVolumeStatus !== volumeFilter) return false

      if (serviceFilter !== "all") {
        if (row.services[serviceFilter] !== "Active") return false
      }

      if (ageFilter !== "all" && getBucketByMonths(row.ageMonths) !== ageFilter) return false
      if (recentFilter !== "all" && getBucketByMonths(row.recencyMonths) !== recentFilter) return false
      return true
    })
  }, [ageFilter, activeOnly, recentFilter, rows, search, serviceFilter, volumeFilter])

  const clearFilters = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("employee")
    next.delete("from")
    next.delete("to")
    next.set("period", "all")
    router.replace(`${pathname}?${next.toString()}`)

    setSearch("")
    setActiveOnly(false)
    setVolumeFilter("all")
    setAgeFilter("all")
    setRecentFilter("all")
    setServiceFilter("all")
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
    if (volumeFilter !== "all") filters.push({ id: "volume", label: `Volume: ${volumeFilter}`, onRemove: () => setVolumeFilter("all") })
    if (serviceFilter !== "all") filters.push({ id: "service", label: `Service: ${serviceFilter.toUpperCase()}`, onRemove: () => setServiceFilter("all") })
    if (ageFilter !== "all") filters.push({ id: "age", label: `Age: ${ageFilter} mo`, onRemove: () => setAgeFilter("all") })
    if (recentFilter !== "all") filters.push({ id: "recent", label: `Recent: ${recentFilter} mo`, onRemove: () => setRecentFilter("all") })

    return filters
  }, [
    activeDatePresetId,
    activeOnly,
    ageFilter,
    datePresets,
    from,
    pathname,
    recentFilter,
    router,
    search,
    searchParams,
    selectedEmployee,
    serviceFilter,
    setQueryParams,
    to,
    volumeFilter,
  ])

  const sortedRows = React.useMemo(() => {
    const direction = projectsSortDirection === "asc" ? 1 : -1
    const rowsToSort = [...filteredRows]

    rowsToSort.sort((a, b) => {
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
  }, [filteredRows, projectsSortDirection, projectsSortKey])

  const projectsTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(sortedRows.length / projectsPageSize)),
    [projectsPageSize, sortedRows.length]
  )

  const pagedRows = React.useMemo(() => {
    const startIndex = (projectsPage - 1) * projectsPageSize
    return sortedRows.slice(startIndex, startIndex + projectsPageSize)
  }, [projectsPage, projectsPageSize, sortedRows])

  const handleProjectsSort = React.useCallback((key: ProjectSortKey) => {
    setProjectsPage(1)
    setProjectsSortKey((previousKey) => {
      if (previousKey === key) {
        setProjectsSortDirection((previousDirection) => (previousDirection === "asc" ? "desc" : "asc"))
        return previousKey
      }

      setProjectsSortDirection(key === "client" || key === "team" || key === "firstTaskDate" || key === "lastTaskDate" ? "asc" : "desc")
      return key
    })
  }, [])

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
  }, [projectsPageSize, search, selectedEmployee, activeOnly, volumeFilter, serviceFilter, ageFilter, recentFilter, from, to, period])

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
          <FilterBarRow className="flex w-full min-w-0 flex-wrap items-center gap-2 md:gap-2">
              <FilterBarGroup className="flex w-full flex-wrap items-center gap-2 md:gap-2">
                <div className="inline-flex h-10 min-w-[180px] flex-[2_1_240px] items-center gap-2 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-3">
                  <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search client..."
                    className="h-8 w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <select
                  value={selectedEmployee}
                  onChange={(event) => setQueryParams({ employee: event.target.value })}
                  className="h-10 min-w-[130px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
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
                <div className="min-w-[130px] flex-1">
                  <LmsTasksDateRangeFilters />
                </div>
                <select
                  value={activeOnly ? "active" : "all"}
                  onChange={(event) => setActiveOnly(event.target.value === "active")}
                  className="h-10 min-w-[120px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <option value="all">All Projects</option>
                  <option value="active">Active Only</option>
                </select>
                <select
                  value={volumeFilter}
                  onChange={(event) => setVolumeFilter(event.target.value as WorkVolumeStatus | "all")}
                  className="h-10 min-w-[120px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <option value="all">Volume</option>
                  {WORK_VOLUME_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      Volume: {status}
                    </option>
                  ))}
                </select>
                <select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value as ServiceKey | "all")}
                  className="h-10 min-w-[110px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <option value="all">Service</option>
                  <option value="seo">Service: SEO</option>
                  <option value="gads">Service: GAds</option>
                  <option value="fads">Service: FAds</option>
                  <option value="tads">Service: TAds</option>
                </select>
                <select
                  value={ageFilter}
                  onChange={(event) => setAgeFilter(event.target.value as AgeOption)}
                  className="h-10 min-w-[100px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <option value="all">Age</option>
                  <option value="0-3">Age: 0-3 mo</option>
                  <option value="3-6">Age: 3-6 mo</option>
                  <option value="6-12">Age: 6-12 mo</option>
                  <option value="12+">Age: 12+ mo</option>
                </select>
                <select
                  value={recentFilter}
                  onChange={(event) => setRecentFilter(event.target.value as AgeOption)}
                  className="h-10 min-w-[115px] flex-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <option value="all">Recent</option>
                  <option value="0-3">Recent: 0-3 mo</option>
                  <option value="3-6">Recent: 3-6 mo</option>
                  <option value="6-12">Recent: 6-12 mo</option>
                  <option value="12+">Recent: 12+ mo</option>
                </select>
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

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Projects Table</CardTitle>
          <CardDescription>My contribution vs team workload per client.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("client")} className="inline-flex items-center gap-1 text-left">
                    <Workflow className="h-4 w-4" />Client {getSortIcon("client")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("services")} className="inline-flex items-center gap-1 text-left">
                    <Waves className="h-4 w-4" />Services {getSortIcon("services")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("team")} className="inline-flex items-center gap-1 text-left">
                    <Users className="h-4 w-4" />Team {getSortIcon("team")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("firstTaskDate")} className="inline-flex items-center gap-1 text-left">
                    <CalendarDays className="h-4 w-4" />1st Task {getSortIcon("firstTaskDate")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("lastTaskDate")} className="inline-flex items-center gap-1 text-left">
                    <CalendarDays className="h-4 w-4" />Last Task {getSortIcon("lastTaskDate")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("myMinutes")} className="inline-flex items-center gap-1 text-left">
                    <Clock3 className="h-4 w-4" />My Hours {getSortIcon("myMinutes")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("teamMinutes")} className="inline-flex items-center gap-1 text-left">
                    Team Hours {getSortIcon("teamMinutes")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("myTasks")} className="inline-flex items-center gap-1 text-left">
                    My Tasks {getSortIcon("myTasks")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("avgMonthlyMinutes")} className="inline-flex items-center gap-1 text-left">
                    Avg Vol {getSortIcon("avgMonthlyMinutes")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleProjectsSort("workVolumeStatus")} className="inline-flex items-center gap-1 text-left">
                    Work Volume {getSortIcon("workVolumeStatus")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow key={row.client}>
                  <TableCell className="font-semibold">{row.client}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md border text-[10px] font-black tracking-[0.06em]", getServiceBadgeClass(row.services.seo))}
                        title={`SEO: ${row.services.seo}`}
                      >
                        SE
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md border text-[10px] font-black tracking-[0.06em]", getServiceBadgeClass(row.services.gads))}
                        title={`GAds: ${row.services.gads}`}
                      >
                        GA
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md border text-[10px] font-black tracking-[0.06em]", getServiceBadgeClass(row.services.fads))}
                        title={`FAds: ${row.services.fads}`}
                      >
                        FB
                      </span>
                      <span
                        className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md border text-[10px] font-black tracking-[0.06em]", getServiceBadgeClass(row.services.tads))}
                        title={`TAds: ${row.services.tads}`}
                      >
                        TT
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {row.team.length === 0 ? "-" : (
                      <div className="space-y-0.5">
                        {row.team.map((member) => (
                          <p
                            key={`${row.client}-${member}`}
                            className={cn(
                              "truncate rounded px-1.5 py-0.5 text-xs font-semibold",
                              normalizeExecutantKey(member) === normalizeExecutantKey(selectedEmployee)
                                ? "bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,white)] text-[var(--brand-primary)]"
                                : "text-[var(--text-primary)]"
                            )}
                          >
                            {member}
                          </p>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{formatDateLabel(row.firstTaskDate)}</TableCell>
                  <TableCell>{formatDateLabel(row.lastTaskDate)}</TableCell>
                  <TableCell>{formatHoursOrMinutes(row.myMinutes)}</TableCell>
                  <TableCell>{formatHoursOrMinutes(row.teamMinutes)}</TableCell>
                  <TableCell>{row.myTasks}</TableCell>
                  <TableCell>{formatHoursOrMinutes(row.avgMonthlyMinutes, 2)} /mo</TableCell>
                  <TableCell>
                    <WorkVolumeBadge status={row.workVolumeStatus} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-[var(--text-secondary)]">
                    No projects match current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {filteredRows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Page {projectsPage} of {projectsTotalPages} · {filteredRows.length} total rows
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  Results
                  <select
                    value={projectsPageSize}
                    onChange={(event) => setProjectsPageSize(Number(event.target.value))}
                    className="h-8 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2 text-xs font-semibold text-[var(--text-primary)] outline-none"
                  >
                    {PROJECTS_PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setProjectsPage((current) => Math.max(1, current - 1))}
                  disabled={projectsPage <= 1}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--line-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setProjectsPage((current) => Math.min(projectsTotalPages, current + 1))}
                  disabled={projectsPage >= projectsTotalPages}
                  className="inline-flex h-8 items-center rounded-md border border-[var(--line-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
                Formula: Avg Vol = My Hours / Months In Range
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                My Hours = total hours logged by selected employee on that client.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Work Volume</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Work Volume is derived from Avg Vol (minutes/month) using business thresholds.
              </p>
              <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                <p>No Work: avg &lt; 20 min/mo</p>
                <p>Low: avg &lt; 90 min/mo</p>
                <p>Medium: avg &lt; 180 min/mo</p>
                <p>Optimal: avg &lt; 300 min/mo</p>
                <p>High: avg ≥ 300 min/mo</p>
                <p>Extra: has work but client is assigned to another specialist</p>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
