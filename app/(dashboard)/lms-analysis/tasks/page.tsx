"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FilterBarDivider, FilterBarGroup, FilterBarRow, FilterBarScroll, FilterBarShell, FilterResultsRow } from "@/components/ui/filter-bar"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { DurationValue } from "@/components/lms-tasks/duration-value"
import { filterTasksByRange, formatHours, getExecutantOptions, isInternalClient } from "@/lib/lms-tasks/analytics"
import { normalizeClientKey, normalizeExecutantKey } from "@/lib/lms-tasks/parsers"
import { detectLmsDatePresetId, type LmsDatePreset, getLmsDatePresets, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { countWorkingDaysInRange } from "@/lib/lms-tasks/date-utils"
import { isLmsMobileOptimizedEnabled } from "@/lib/lms-tasks/feature-flags"
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, ListTodo, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

const DEFAULT_EMPLOYEE_NAME = "Marius Ciurariu"

type EmployeeRow = {
  name: string
  totalMinutes: number
  internalMinutes: number
  internalPercent: number
  utilizationPercent: number
  sharePercent: number
  tasksCount: number
  clientsCount: number
}

type TaskBreakdownRow = {
  taskName: string
  totalMinutes: number
  contributors: Array<{ name: string; minutes: number; percent: number }>
}

type LoggedTaskRow = {
  key: string
  domain: string
  projectType: string
  minutes: number
  dateLabel: string
  executant: string
  sortDate: number
}

type ComboboxOption = {
  label: string
  value: string
}

const TASK_TYPE_CHART_COLORS = ["#3b82f6", "#10b981", "#eab308", "#f97316", "#ef4444", "#1e293b"]
const TASK_LOGS_DEFAULT_PAGE_SIZE = 25
const TASK_LOGS_PAGE_SIZE_OPTIONS = [25, 50] as const

type TaskLogSortKey = "domain" | "minutes" | "date"
type TaskLogSortDirection = "asc" | "desc"

function parseMaybeDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

function toYmd(value: Date) {
  return format(value, "yyyy-MM-dd")
}

function formatTaskEntryDate(value: string | null) {
  const parsed = parseMaybeDate(value)
  if (!parsed) return "-"
  return format(parsed, "dd MMM yyyy")
}

function getUtilizationTone(percent: number) {
  if (percent < 30) return { track: "bg-red-100", fill: "bg-red-300" }
  if (percent < 65) return { track: "bg-amber-100", fill: "bg-amber-300" }
  return { track: "bg-emerald-100", fill: "bg-emerald-300" }
}

export default function LmsAnalysisTasksPage() {
  const mobileOptimized = isLmsMobileOptimizedEnabled()
  const { ready, data } = useLmsTasksData()
  const { start, end } = useLmsDateRange()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const selectedEmployeeParam = searchParams.get("employee")
  const selectedDomain = searchParams.get("domain") || "all"
  const search = searchParams.get("search") || ""
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const period = searchParams.get("period")
  const activeDatePresetId = detectLmsDatePresetId(from || null, to || null, period)
  const datePresets = React.useMemo(() => getLmsDatePresets(), [])
  const selectedFromDate = React.useMemo(() => parseMaybeDate(from), [from])
  const selectedToDate = React.useMemo(() => parseMaybeDate(to), [to])
  const selectedDateRange = React.useMemo<DateRange | undefined>(
    () =>
      selectedFromDate || selectedToDate
        ? {
            from: selectedFromDate || undefined,
            to: selectedToDate || undefined,
          }
        : undefined,
    [selectedFromDate, selectedToDate]
  )

  const setQueryParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          next.delete(key)
          continue
        }

        if (value === "all") {
          if (key === "employee") next.set("employee", "all")
          else next.delete(key)
          continue
        }

        next.set(key, value)
      }
      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handleDatePresetChange = React.useCallback(
    (presetId: string) => {
      const preset = resolveLmsDatePreset(presetId)
      const next = new URLSearchParams(searchParams.toString())
      if (preset.from) next.set("from", preset.from)
      else next.delete("from")
      if (preset.to) next.set("to", preset.to)
      else next.delete("to")
      next.set("period", preset.id)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handleCustomDateRange = React.useCallback(
    (range: DateRange) => {
      const next = new URLSearchParams(searchParams.toString())
      const nextFrom = range.from ? toYmd(range.from) : null
      const nextTo = range.to ? toYmd(range.to) : null

      if (nextFrom) next.set("from", nextFrom)
      else next.delete("from")
      if (nextTo) next.set("to", nextTo)
      else next.delete("to")
      next.set("period", "custom")

      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const clearAllFilters = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("employee", "all")
    next.delete("domain")
    next.delete("search")
    next.delete("from")
    next.delete("to")
    next.set("period", "all")
    router.replace(`${pathname}?${next.toString()}`)
  }, [pathname, router, searchParams])

  React.useEffect(() => {
    // Default first load to This Quarter when no explicit date filter is set.
    // Keep manual "All Time" selection working by not overriding period=all.
    if (from || to || period) return
    const preset = resolveLmsDatePreset("this-quarter")
    const next = new URLSearchParams(searchParams.toString())
    if (preset.from) next.set("from", preset.from)
    if (preset.to) next.set("to", preset.to)
    next.set("period", preset.id)
    router.replace(`${pathname}?${next.toString()}`)
  }, [from, to, period, pathname, router, searchParams])

  const tasksInDateRange = React.useMemo(() => filterTasksByRange(data.tasks, start, end), [data.tasks, start, end])
  const executantOptions = React.useMemo(
    () => getExecutantOptions(tasksInDateRange, data.allocations),
    [tasksInDateRange, data.allocations]
  )
  const defaultEmployeeOption = React.useMemo(() => {
    const target = normalizeExecutantKey(DEFAULT_EMPLOYEE_NAME)
    return executantOptions.find((name) => normalizeExecutantKey(name) === target) ?? null
  }, [executantOptions])
  const selectedEmployee = selectedEmployeeParam || defaultEmployeeOption || "all"
  const domainOptions = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasksInDateRange) {
      const key = normalizeClientKey(task.client)
      if (!key) continue
      if (!map.has(key)) map.set(key, task.client)
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
  }, [tasksInDateRange])

  const filteredTasks = React.useMemo(() => {
    const employeeKey = normalizeExecutantKey(selectedEmployee)
    const domainKey = normalizeClientKey(selectedDomain)
    const searchNeedle = search.trim().toLowerCase()

    return tasksInDateRange.filter((task) => {
      if (selectedEmployee !== "all" && normalizeExecutantKey(task.executant) !== employeeKey) return false
      if (selectedDomain !== "all" && normalizeClientKey(task.client) !== domainKey) return false
      if (searchNeedle) {
        const haystack = `${task.taskName} ${task.client} ${task.executant}`.toLowerCase()
        if (!haystack.includes(searchNeedle)) return false
      }
      return true
    })
  }, [search, selectedDomain, selectedEmployee, tasksInDateRange])

  const tasksForEmployeeTable = React.useMemo(() => {
    const domainKey = normalizeClientKey(selectedDomain)
    const searchNeedle = search.trim().toLowerCase()

    return tasksInDateRange.filter((task) => {
      if (selectedDomain !== "all" && normalizeClientKey(task.client) !== domainKey) return false
      if (searchNeedle) {
        const haystack = `${task.taskName} ${task.client} ${task.executant}`.toLowerCase()
        if (!haystack.includes(searchNeedle)) return false
      }
      return true
    })
  }, [search, selectedDomain, tasksInDateRange])

  const totalMinutes = React.useMemo(
    () => filteredTasks.reduce((sum, task) => sum + task.durationMinutes, 0),
    [filteredTasks]
  )
  const workingDays = React.useMemo(() => countWorkingDaysInRange(start, end), [end, start])
  const workingCapacityMinutes = React.useMemo(() => Math.max(0, workingDays) * 8 * 60, [workingDays])
  const totalTasks = filteredTasks.length
  const internalTaskCount = React.useMemo(
    () => filteredTasks.filter((task) => isInternalClient(task.client)).length,
    [filteredTasks]
  )
  const internalMinutes = React.useMemo(
    () => filteredTasks.filter((task) => isInternalClient(task.client)).reduce((sum, task) => sum + task.durationMinutes, 0),
    [filteredTasks]
  )
  const internalTaskPercent = totalTasks > 0 ? (internalTaskCount / totalTasks) * 100 : 0

  const employeeTableTotalMinutes = React.useMemo(
    () => tasksForEmployeeTable.reduce((sum, task) => sum + task.durationMinutes, 0),
    [tasksForEmployeeTable]
  )

  const employeeRows = React.useMemo<EmployeeRow[]>(() => {
    const map = new Map<
      string,
      {
        name: string
        total: number
        internal: number
        tasksCount: number
        clients: Set<string>
      }
    >()

    for (const task of tasksForEmployeeTable) {
      const key = normalizeExecutantKey(task.executant) || "unassigned"
      const current = map.get(key) ?? {
        name: task.executant || "Unassigned",
        total: 0,
        internal: 0,
        tasksCount: 0,
        clients: new Set<string>(),
      }
      current.total += task.durationMinutes
      if (isInternalClient(task.client)) current.internal += task.durationMinutes
      current.tasksCount += 1
      if (!isInternalClient(task.client)) {
        const clientKey = normalizeClientKey(task.client)
        if (clientKey) current.clients.add(clientKey)
      }
      map.set(key, current)
    }

    return Array.from(map.values())
      .map((entry) => ({
        name: entry.name,
        totalMinutes: entry.total,
        internalMinutes: entry.internal,
        internalPercent: entry.total > 0 ? Number(((entry.internal / entry.total) * 100).toFixed(1)) : 0,
        utilizationPercent: workingCapacityMinutes > 0 ? Number(((entry.total / workingCapacityMinutes) * 100).toFixed(1)) : 0,
        sharePercent: employeeTableTotalMinutes > 0 ? Number(((entry.total / employeeTableTotalMinutes) * 100).toFixed(1)) : 0,
        tasksCount: entry.tasksCount,
        clientsCount: entry.clients.size,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [employeeTableTotalMinutes, tasksForEmployeeTable, workingCapacityMinutes])

  const taskBreakdownRows = React.useMemo<TaskBreakdownRow[]>(() => {
    const taskMap = new Map<string, { total: number; contributors: Map<string, number> }>()
    for (const task of filteredTasks) {
      const current = taskMap.get(task.taskName) ?? { total: 0, contributors: new Map<string, number>() }
      current.total += task.durationMinutes
      current.contributors.set(task.executant, (current.contributors.get(task.executant) ?? 0) + task.durationMinutes)
      taskMap.set(task.taskName, current)
    }

    return Array.from(taskMap.entries())
      .map(([taskName, value]) => ({
        taskName,
        totalMinutes: value.total,
        contributors: Array.from(value.contributors.entries())
          .map(([name, minutes]) => ({
            name,
            minutes,
            percent: value.total > 0 ? Number(((minutes / value.total) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.minutes - a.minutes),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [filteredTasks])

  const taskTypeTotalMinutes = React.useMemo(
    () => taskBreakdownRows.reduce((sum, row) => sum + row.totalMinutes, 0),
    [taskBreakdownRows]
  )
  const taskTypeTotalCount = taskBreakdownRows.length

  const taskTypeChartRows = React.useMemo(() => {
    const maxSlices = 6
    const rows = taskBreakdownRows.map((row, index) => ({
      name: row.taskName,
      minutes: row.totalMinutes,
      percent: taskTypeTotalMinutes > 0 ? Number(((row.totalMinutes / taskTypeTotalMinutes) * 100).toFixed(1)) : 0,
      color: TASK_TYPE_CHART_COLORS[index % TASK_TYPE_CHART_COLORS.length],
    }))

    if (rows.length <= maxSlices) return rows

    const kept = rows.slice(0, maxSlices)
    const otherMinutes = rows.slice(maxSlices).reduce((sum, row) => sum + row.minutes, 0)
    const otherPercent = taskTypeTotalMinutes > 0 ? Number(((otherMinutes / taskTypeTotalMinutes) * 100).toFixed(1)) : 0
    return [
      ...kept,
      {
        name: "Other",
        minutes: otherMinutes,
        percent: otherPercent,
        color: TASK_TYPE_CHART_COLORS[maxSlices % TASK_TYPE_CHART_COLORS.length],
      },
    ]
  }, [taskBreakdownRows, taskTypeTotalMinutes])

  const taskTypeListRows = React.useMemo(
    () =>
      taskBreakdownRows.map((row, index) => ({
        name: row.taskName,
        minutes: row.totalMinutes,
        percent: taskTypeTotalMinutes > 0 ? Number(((row.totalMinutes / taskTypeTotalMinutes) * 100).toFixed(1)) : 0,
        color: TASK_TYPE_CHART_COLORS[index % TASK_TYPE_CHART_COLORS.length],
      })),
    [taskBreakdownRows, taskTypeTotalMinutes]
  )

  const loggedTaskRows = React.useMemo<LoggedTaskRow[]>(
    () =>
      filteredTasks
        .map((task, index) => ({
          key: `${task.id}-${index}`,
          domain: task.client || "Unknown Client",
          projectType: task.taskName || "Untitled Task",
          minutes: task.durationMinutes,
          dateLabel: formatTaskEntryDate(task.date),
          executant: task.executant || "Unassigned",
          sortDate: parseMaybeDate(task.date)?.getTime() ?? -1,
        })),
    [filteredTasks]
  )

  const [isTaskTypeListExpanded, setIsTaskTypeListExpanded] = React.useState(false)
  const [taskLogSortKey, setTaskLogSortKey] = React.useState<TaskLogSortKey>("date")
  const [taskLogSortDirection, setTaskLogSortDirection] = React.useState<TaskLogSortDirection>("desc")
  const [taskLogPage, setTaskLogPage] = React.useState(1)
  const [taskLogPageSize, setTaskLogPageSize] = React.useState<number>(TASK_LOGS_DEFAULT_PAGE_SIZE)

  const sortedLoggedTaskRows = React.useMemo(() => {
    const rows = [...loggedTaskRows]
    rows.sort((a, b) => {
      if (taskLogSortKey === "domain") {
        const byDomain = a.domain.localeCompare(b.domain)
        if (byDomain !== 0) return taskLogSortDirection === "asc" ? byDomain : -byDomain
        if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate
        return b.minutes - a.minutes
      }

      if (taskLogSortKey === "minutes") {
        if (a.minutes !== b.minutes) return taskLogSortDirection === "asc" ? a.minutes - b.minutes : b.minutes - a.minutes
        if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate
        return a.domain.localeCompare(b.domain)
      }

      if (a.sortDate !== b.sortDate) return taskLogSortDirection === "asc" ? a.sortDate - b.sortDate : b.sortDate - a.sortDate
      if (a.minutes !== b.minutes) return b.minutes - a.minutes
      return a.domain.localeCompare(b.domain)
    })
    return rows
  }, [loggedTaskRows, taskLogSortDirection, taskLogSortKey])

  const taskLogTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(sortedLoggedTaskRows.length / taskLogPageSize)),
    [sortedLoggedTaskRows.length, taskLogPageSize]
  )

  const pagedLoggedTaskRows = React.useMemo(() => {
    const startIndex = (taskLogPage - 1) * taskLogPageSize
    return sortedLoggedTaskRows.slice(startIndex, startIndex + taskLogPageSize)
  }, [sortedLoggedTaskRows, taskLogPage, taskLogPageSize])

  const toggleTaskLogSort = React.useCallback(
    (key: TaskLogSortKey) => {
      setTaskLogPage(1)
      setTaskLogSortKey((previousKey) => {
        if (previousKey === key) {
          setTaskLogSortDirection((previousDirection) => (previousDirection === "asc" ? "desc" : "asc"))
          return previousKey
        }

        setTaskLogSortDirection(key === "domain" ? "asc" : "desc")
        return key
      })
    },
    [setTaskLogPage, setTaskLogSortDirection, setTaskLogSortKey]
  )

  const getSortIcon = React.useCallback(
    (key: TaskLogSortKey) => {
      if (taskLogSortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      if (taskLogSortDirection === "asc") return <ArrowUp className="h-3.5 w-3.5" />
      return <ArrowDown className="h-3.5 w-3.5" />
    },
    [taskLogSortDirection, taskLogSortKey]
  )

  React.useEffect(() => {
    if (taskLogPage > taskLogTotalPages) {
      setTaskLogPage(taskLogTotalPages)
    }
  }, [taskLogPage, taskLogTotalPages])

  React.useEffect(() => {
    setTaskLogPage(1)
  }, [taskLogPageSize])

  React.useEffect(() => {
    setIsTaskTypeListExpanded(false)
  }, [selectedEmployee, selectedDomain, search, start, end])

  React.useEffect(() => {
    setTaskLogPage(1)
  }, [selectedEmployee, selectedDomain, search, start, end])

  const activeFilters = React.useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = []
    if (selectedEmployee !== "all") {
      filters.push({
        id: "employee",
        label: `Employee: ${selectedEmployee}`,
        onRemove: () => setQueryParams({ employee: "all" }),
      })
    }
    if (selectedDomain !== "all") {
      filters.push({
        id: "domain",
        label: `Domain: ${selectedDomain}`,
        onRemove: () => setQueryParams({ domain: "all" }),
      })
    }
    if (search.trim()) {
      filters.push({
        id: "search",
        label: `Search: ${search.trim()}`,
        onRemove: () => setQueryParams({ search: null }),
      })
    }
    if (activeDatePresetId === "custom") {
      const customLabel = `${selectedFromDate ? format(selectedFromDate, "dd MMM yyyy") : "..."} - ${selectedToDate ? format(selectedToDate, "dd MMM yyyy") : "..."}`
      filters.push({
        id: "date",
        label: `Date: ${customLabel}`,
        onRemove: () => handleDatePresetChange("all"),
      })
    } else {
      const preset = datePresets.find((item) => item.id === activeDatePresetId)
      if (preset && preset.id !== "all") {
        filters.push({
          id: "date",
          label: `Date: ${preset.label}`,
          onRemove: () => handleDatePresetChange("all"),
        })
      }
    }
    return filters
  }, [
    activeDatePresetId,
    datePresets,
    handleDatePresetChange,
    search,
    selectedDomain,
    selectedEmployee,
    selectedFromDate,
    selectedToDate,
    setQueryParams,
  ])

  const employeeOptions = React.useMemo<ComboboxOption[]>(
    () => [{ value: "all", label: "All Employees" }, ...executantOptions.map((name) => ({ value: name, label: name }))],
    [executantOptions]
  )
  const domainSelectOptions = React.useMemo<ComboboxOption[]>(
    () => [{ value: "all", label: "All Domains" }, ...domainOptions.map((domain) => ({ value: domain, label: domain }))],
    [domainOptions]
  )
  const selectedDatePreset = React.useMemo(
    () => datePresets.find((preset) => preset.id === activeDatePresetId) ?? null,
    [activeDatePresetId, datePresets]
  )
  const dateFilterLabel =
    activeDatePresetId === "custom"
      ? `${selectedFromDate ? format(selectedFromDate, "dd MMM") : "..."} - ${selectedToDate ? format(selectedToDate, "dd MMM") : "..."}`
      : (selectedDatePreset?.label ?? "Date")

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.tasks.length === 0) {
    return <LmsTasksEmptyState />
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <FilterBarShell className="rounded-2xl border-[var(--line-subtle)] bg-[var(--bg-surface)] px-5 py-4 shadow-none">
          <FilterBarScroll>
            <FilterBarRow wrap className="items-center gap-2 md:gap-4">
              <FilterBarGroup wrap className="w-full gap-2 md:gap-4">
                <div
                  className={cn(
                    "inline-flex h-10 min-w-[170px] flex-[2_1_240px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                    search.trim()
                      ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
                      : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                  )}
                >
                  <Search className="h-4 w-4 opacity-70" />
                  <input
                    value={search}
                    onChange={(event) => setQueryParams({ search: event.target.value })}
                    placeholder="Search"
                    className="h-8 min-w-[180px] border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <FilterBarDivider className="hidden md:block md:mx-1" />
                <InlineCombobox
                  label={selectedEmployee === "all" ? "Employee" : selectedEmployee}
                  options={employeeOptions}
                  selectedValue={selectedEmployee}
                  onSelect={(value) => setQueryParams({ employee: value })}
                  searchPlaceholder="Search employee..."
                  emptyLabel="No employee found."
                  isActive={selectedEmployee !== "all"}
                />
              <FilterBarDivider className="hidden md:block md:mx-1" />
                <InlineCombobox
                  label={selectedDomain === "all" ? "Domain" : selectedDomain}
                  options={domainSelectOptions}
                  selectedValue={selectedDomain}
                  onSelect={(value) => setQueryParams({ domain: value })}
                  searchPlaceholder="Search domain..."
                  emptyLabel="No domain found."
                  isActive={selectedDomain !== "all"}
                />
                <FilterBarDivider className="hidden md:block md:mx-1" />
                <DateFilterCombobox
                  label={dateFilterLabel}
                  presets={datePresets}
                  activePresetId={activeDatePresetId}
                  selectedRange={selectedDateRange}
                  onSelectPreset={handleDatePresetChange}
                  onSelectRange={handleCustomDateRange}
                />
              </FilterBarGroup>
            </FilterBarRow>
          </FilterBarScroll>
        </FilterBarShell>
        <FilterResultsRow className="justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{filteredTasks.length} Results found</p>
            {activeFilters.length > 0 && <span className="text-[var(--line-subtle)]">|</span>}
            {activeFilters.map((filter) => (
              <span
                key={filter.id}
                className="inline-flex h-7 items-center rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,var(--surface-lowest))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_12%,var(--surface-lowest))] px-2.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--brand-primary)]"
              >
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={filter.onRemove}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--brand-primary)]/80 transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand-cyan)_20%,var(--surface-lowest))] hover:text-[var(--brand-primary)]"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {activeFilters.length > 0 ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-7 items-center rounded-full px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </FilterResultsRow>
      </div>

      <div className="flex flex-col lg:flex-row overflow-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        {/* Worked Hours Card */}
        <div className="relative flex-1 border-b border-[var(--line-subtle)] p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex items-start justify-between">
            <p className="ui-overline text-[var(--text-muted)]">Worked Hours</p>
            <Clock3 className="absolute right-4 top-4 h-8 w-8 text-slate-100" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <DurationValue
                minutes={totalMinutes}
                className="text-[32px] leading-none tracking-tight"
                numberClassName="font-bold text-[var(--text-primary)]"
                unitClassName="font-bold text-[var(--text-muted)]"
              />
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[var(--brand-primary)]">Within selected filters</p>
            </div>
          </div>
        </div>

        {/* Total Tasks Card */}
        <div className="relative flex-1 border-b border-[var(--line-subtle)] p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex items-start justify-between">
            <p className="ui-overline text-[var(--text-muted)]">Total Tasks</p>
            <ListTodo className="absolute right-4 top-4 h-8 w-8 text-slate-100" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[32px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{totalTasks}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">In current selection</p>
            </div>
          </div>
        </div>

        {/* Working Days Card */}
        <div className="relative flex-1 border-b border-[var(--line-subtle)] p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex items-start justify-between">
            <p className="ui-overline text-[var(--text-muted)]">Working Days</p>
            <CalendarClock className="absolute right-4 top-4 h-8 w-8 text-slate-100" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[32px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{workingDays}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{start} to {end}</p>
            </div>
          </div>
        </div>

        {/* Internal Work Card */}
        <div className="relative flex-1 p-6 lg:p-8">
          <div className="flex items-start justify-between">
            <p className="ui-overline text-[var(--text-muted)]">Internal work</p>
            <Building2 className="absolute right-4 top-4 h-8 w-8 text-slate-100" />
          </div>
          <div className="mt-6 flex items-end gap-6">
            <div className="min-w-[60px]">
              <p className="text-[32px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{internalTaskCount}</p>
              <p className="mt-1 text-[10px] italic text-[var(--text-muted)]">Total tasks</p>
            </div>
            <div className="flex-1 space-y-2 border-l border-[var(--line-subtle)] pl-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--brand-primary)]">Ratio</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{internalTaskPercent.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--brand-primary)]">Hours</span>
                <DurationValue minutes={internalMinutes} className="text-sm" numberClassName="font-bold text-[var(--text-primary)]" unitClassName="font-bold text-[var(--text-secondary)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Hours by Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(mobileOptimized && "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Nr. Tasks</TableHead>
                  <TableHead>Nr. Clients</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Hours vs Capacity</TableHead>
                  <TableHead>Team Share %</TableHead>
                  <TableHead>Internal Work %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeRows.map((row) => {
                  const barPercent = Math.min(100, Math.max(0, row.utilizationPercent))
                  const tone = getUtilizationTone(row.utilizationPercent)

                  return (
                    <TableRow key={row.name}>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell>{row.tasksCount}</TableCell>
                      <TableCell>{row.clientsCount}</TableCell>
                      <TableCell><DurationValue minutes={row.totalMinutes} /></TableCell>
                      <TableCell>
                        <div className="w-[190px] max-w-full space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                              <DurationValue minutes={row.totalMinutes} className="text-xs" />
                              <span>/</span>
                              <DurationValue minutes={workingCapacityMinutes} className="text-xs" />
                            </span>
                            <span className="font-medium text-[var(--text-secondary)]">{row.utilizationPercent.toFixed(1)}%</span>
                          </div>
                          <div className={`h-2.5 w-full overflow-hidden rounded-full ${tone.track}`}>
                            <div className={`h-full rounded-full transition-all ${tone.fill}`} style={{ width: `${barPercent}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.sharePercent.toFixed(1)}%</TableCell>
                      <TableCell>{row.internalPercent.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })}
                {employeeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[var(--text-secondary)]">
                      No employee activity for current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {mobileOptimized ? (
            <div className="space-y-3 md:hidden">
              {employeeRows.map((row) => {
                const barPercent = Math.min(100, Math.max(0, row.utilizationPercent))
                const tone = getUtilizationTone(row.utilizationPercent)

                return (
                  <article
                    key={`mobile-${row.name}`}
                    className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{row.name}</p>
                      <DurationValue minutes={row.totalMinutes} className="text-sm" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <p>Tasks: <span className="font-semibold text-[var(--text-primary)]">{row.tasksCount}</span></p>
                      <p>Clients: <span className="font-semibold text-[var(--text-primary)]">{row.clientsCount}</span></p>
                      <p>Team share: <span className="font-semibold text-[var(--text-primary)]">{row.sharePercent.toFixed(1)}%</span></p>
                      <p>Internal: <span className="font-semibold text-[var(--text-primary)]">{row.internalPercent.toFixed(1)}%</span></p>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--text-secondary)]">Capacity</span>
                        <span className="font-semibold text-[var(--text-primary)]">{row.utilizationPercent.toFixed(1)}%</span>
                      </div>
                      <div className={`h-3 w-full overflow-hidden rounded-full ${tone.track}`}>
                        <div className={`h-full rounded-full transition-all ${tone.fill}`} style={{ width: `${barPercent}%` }} />
                      </div>
                    </div>
                  </article>
                )
              })}
              {employeeRows.length === 0 ? (
                <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
                  No employee activity for current filters.
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Tasks Type</CardTitle>
        </CardHeader>
        <CardContent>
          {taskTypeChartRows.length === 0 ? (
            <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
              No task type data available for current filters.
            </div>
          ) : (
            <div className="grid items-center gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
              <div className="relative flex h-[280px] items-center justify-center md:h-[320px]">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskTypeChartRows}
                        dataKey="minutes"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={86}
                        outerRadius={118}
                        paddingAngle={2}
                        stroke="transparent"
                      >
                        {taskTypeChartRows.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null
                          const entry = payload[0]?.payload as { name: string; minutes: number; percent: number }
                          if (!entry) return null
                          return (
                            <div className="rounded-md bg-slate-900/90 px-2 py-1.5">
                              <p className="text-xs font-semibold text-slate-100">{entry.name}</p>
                              <p className="text-xs text-slate-100">{formatHours(entry.minutes)} · {entry.percent.toFixed(1)}%</p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="pointer-events-none relative z-10 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Hours</p>
                    <DurationValue minutes={taskTypeTotalMinutes} className="text-4xl" numberClassName="font-bold text-[var(--text-primary)]" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {(isTaskTypeListExpanded ? taskTypeListRows : taskTypeListRows.slice(0, 6)).map((row) => (
                  <div key={row.name} className="flex items-center justify-between rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: row.color }} />
                        {row.name}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="whitespace-nowrap text-lg font-bold text-[var(--text-primary)] inline-flex items-center">
                        <DurationValue minutes={row.minutes} className="text-lg" numberClassName="font-bold text-[var(--text-primary)]" />
                        <span className="ml-4 text-sm font-semibold text-[var(--text-secondary)]">{row.percent.toFixed(1)}%</span>
                      </p>
                    </div>
                  </div>
                ))}
                {taskTypeListRows.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setIsTaskTypeListExpanded((prev) => !prev)}
                    className="w-full rounded-xl border border-transparent py-2 text-center text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--line-subtle)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                  >
                    {isTaskTypeListExpanded ? "Show less" : `See all ${taskTypeTotalCount} task types`}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Actual Tasks Logged</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(mobileOptimized && "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleTaskLogSort("domain")}
                      className="inline-flex items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      aria-label="Sort by domain"
                    >
                      <span>Domain</span>
                      {getSortIcon("domain")}
                    </button>
                  </TableHead>
                  <TableHead>Project Type</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleTaskLogSort("minutes")}
                      className="inline-flex items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      aria-label="Sort by hours worked"
                    >
                      <span>Hours Worked</span>
                      {getSortIcon("minutes")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleTaskLogSort("date")}
                      className="inline-flex items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      aria-label="Sort by date entry"
                    >
                      <span>Date Entry</span>
                      {getSortIcon("date")}
                    </button>
                  </TableHead>
                  <TableHead>Executant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLoggedTaskRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-semibold">{row.domain}</TableCell>
                    <TableCell>{row.projectType}</TableCell>
                    <TableCell><DurationValue minutes={row.minutes} /></TableCell>
                    <TableCell>{row.dateLabel}</TableCell>
                    <TableCell>{row.executant}</TableCell>
                  </TableRow>
                ))}
                {sortedLoggedTaskRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-[var(--text-secondary)]">
                      No task entries for current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {mobileOptimized ? (
            <div className="space-y-3 md:hidden">
              {pagedLoggedTaskRows.map((row) => (
                <article key={`mobile-${row.key}`} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{row.domain}</p>
                    <DurationValue minutes={row.minutes} className="text-sm" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{row.projectType}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{row.dateLabel}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{row.executant}</span>
                  </div>
                </article>
              ))}
              {sortedLoggedTaskRows.length === 0 ? (
                <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
                  No task entries for current filters.
                </div>
              ) : null}
            </div>
          ) : null}
          {sortedLoggedTaskRows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <select
                    value={taskLogPageSize}
                    onChange={(event) => setTaskLogPageSize(Number(event.target.value))}
                    className="h-8 min-w-[58px] appearance-none rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] pl-2 pr-6 text-[11px] font-semibold text-[var(--text-primary)] outline-none"
                    aria-label="Rows per page"
                  >
                    {TASK_LOGS_PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
                </div>
                <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)]">
                  {taskLogPage}/{taskLogTotalPages}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTaskLogPage((current) => Math.max(1, current - 1))}
                  disabled={taskLogPage <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTaskLogPage((current) => Math.min(taskLogTotalPages, current + 1))}
                  disabled={taskLogPage >= taskLogTotalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function DateFilterCombobox({
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
  onSelectPreset: (value: string) => void
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
            "inline-flex h-10 min-w-[130px] flex-1 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-medium transition-all md:flex-none",
            activePresetId !== "all"
              ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
              : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
          )}
        >
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(calc(100vw-2rem),404px)] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-apple)]"
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

function InlineCombobox({
  label,
  options,
  selectedValue,
  onSelect,
  searchPlaceholder,
  emptyLabel,
  isActive,
}: {
  label: string
  options: ComboboxOption[]
  selectedValue: string
  onSelect: (value: string) => void
  searchPlaceholder: string
  emptyLabel: string
  isActive: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 min-w-[130px] flex-1 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-medium transition-all md:flex-none",
            isActive
              ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
              : "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
          )}
        >
          <span className="max-w-[180px] truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-0 shadow-[var(--shadow-apple)]">
        <Command className="rounded-xl">
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg"
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedValue === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
