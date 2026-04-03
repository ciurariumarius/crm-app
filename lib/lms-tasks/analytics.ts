import {
  countWorkingDaysInMonth,
  countWorkingDaysInRange,
  getMonthKeyFromIso,
  getMonthLabel,
  listMonthKeysBetween,
  parseIsoDateToUtcDate,
  toIsoDate,
  toIsoDateFromParts,
} from "@/lib/lms-tasks/date-utils"
import { normalizeClientKey, normalizeExecutantKey } from "@/lib/lms-tasks/parsers"
import type {
  ClientAllocation,
  ClientExplorerRow,
  LmsDateRange,
  MonthlyUtilizationRow,
  MyProjectRow,
  TaskLog,
  TeamWorkloadRow,
  WorkVolumeStatus,
} from "@/lib/lms-tasks/types"

const MINUTES_PER_WORKDAY = 8 * 60

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Number(value.toFixed(2)))
}

function nowIsoRange() {
  const now = new Date()
  const start = toIsoDateFromParts(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)))
  return { start, end }
}

function sortIsoAsc(a: string, b: string) {
  return a.localeCompare(b)
}

function dedupeAndSort(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

export function resolveEffectiveDateRange(tasks: TaskLog[], requested: LmsDateRange): { start: string; end: string } {
  const requestedFrom = requested.from && parseIsoDateToUtcDate(requested.from) ? requested.from : null
  const requestedTo = requested.to && parseIsoDateToUtcDate(requested.to) ? requested.to : null

  if (requestedFrom && requestedTo && requestedFrom <= requestedTo) {
    return { start: requestedFrom, end: requestedTo }
  }

  const validTaskDates = tasks.map((task) => task.date).filter((value): value is string => Boolean(value)).sort(sortIsoAsc)
  const minTaskDate = validTaskDates[0] ?? null
  const maxTaskDate = validTaskDates[validTaskDates.length - 1] ?? null

  if (requestedFrom && requestedTo && requestedFrom > requestedTo) {
    return { start: requestedTo, end: requestedFrom }
  }

  if (requestedFrom && maxTaskDate) return { start: requestedFrom, end: maxTaskDate >= requestedFrom ? maxTaskDate : requestedFrom }
  if (requestedTo && minTaskDate) return { start: minTaskDate <= requestedTo ? minTaskDate : requestedTo, end: requestedTo }
  if (minTaskDate && maxTaskDate) return { start: minTaskDate, end: maxTaskDate }
  return nowIsoRange()
}

export function isTaskInRange(task: TaskLog, startIso: string, endIso: string) {
  if (!task.date) return false
  return task.date >= startIso && task.date <= endIso
}

export function filterTasksByRange(tasks: TaskLog[], startIso: string, endIso: string) {
  return tasks.filter((task) => isTaskInRange(task, startIso, endIso))
}

export function calculateWorkVolumeStatus(avgMinutesPerMonth: number, hasTasks: boolean, hasAllocation: boolean): WorkVolumeStatus {
  if (hasTasks && !hasAllocation) return "Extra"
  if (avgMinutesPerMonth < 20) return "No Work"
  if (avgMinutesPerMonth < 90) return "Low"
  if (avgMinutesPerMonth < 180) return "Medium"
  if (avgMinutesPerMonth < 300) return "Optimal"
  return "High"
}

export function isInternalClient(client: string) {
  const normalized = client.toLowerCase()
  return normalized.includes("[intern]") || normalized.includes("internal")
}

export function getExecutantOptions(tasks: TaskLog[], allocations: ClientAllocation[]) {
  const fromTasks = tasks.map((task) => task.executant.trim()).filter(Boolean)
  const fromAllocations = allocations.map((allocation) => allocation.specialist.trim()).filter(Boolean)
  return dedupeAndSort([...fromTasks, ...fromAllocations])
}

export function buildAllocationLookup(allocations: ClientAllocation[]) {
  const map = new Map<string, ClientAllocation>()
  for (const allocation of allocations) {
    map.set(normalizeClientKey(allocation.client), allocation)
  }
  return map
}

export function buildTopStats(tasks: TaskLog[], allocations: ClientAllocation[]) {
  const uniqueClients = new Set<string>()
  for (const task of tasks) uniqueClients.add(normalizeClientKey(task.client))
  for (const allocation of allocations) uniqueClients.add(normalizeClientKey(allocation.client))

  const activeServices = allocations.reduce(
    (acc, allocation) => {
      if (allocation.seo === "Active") acc.seo += 1
      if (allocation.gads === "Active") acc.gads += 1
      if (allocation.fads === "Active") acc.fads += 1
      if (allocation.tads === "Active") acc.tads += 1
      return acc
    },
    { seo: 0, gads: 0, fads: 0, tads: 0 }
  )

  return {
    totalProjects: uniqueClients.size,
    activeServices,
  }
}

export function buildMonthlyUtilization(tasks: TaskLog[], startIso: string, endIso: string): MonthlyUtilizationRow[] {
  const monthKeys = listMonthKeysBetween(startIso, endIso)
  const filtered = filterTasksByRange(tasks, startIso, endIso)
  const teamSize = new Set(filtered.map((task) => normalizeExecutantKey(task.executant)).filter(Boolean)).size
  const monthlyLoggedMap = new Map<string, number>()

  for (const task of filtered) {
    if (!task.date) continue
    const monthKey = getMonthKeyFromIso(task.date)
    monthlyLoggedMap.set(monthKey, (monthlyLoggedMap.get(monthKey) ?? 0) + task.durationMinutes)
  }

  return monthKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-").map(Number)
    const capacityMinutes = countWorkingDaysInMonth(year, month - 1) * MINUTES_PER_WORKDAY * teamSize
    const loggedMinutes = monthlyLoggedMap.get(monthKey) ?? 0
    const utilizationPercent = capacityMinutes > 0 ? clampPercent((loggedMinutes / capacityMinutes) * 100) : 0

    return {
      monthKey,
      monthLabel: getMonthLabel(monthKey),
      loggedMinutes,
      capacityMinutes,
      utilizationPercent,
    }
  })
}

export function buildTeamWorkload(tasks: TaskLog[], startIso: string, endIso: string): TeamWorkloadRow[] {
  const filtered = filterTasksByRange(tasks, startIso, endIso)
  const expectedCapacityMinutes = countWorkingDaysInRange(startIso, endIso) * MINUTES_PER_WORKDAY
  const map = new Map<string, { name: string; totalMinutes: number; internalMinutes: number }>()

  for (const task of filtered) {
    const key = normalizeExecutantKey(task.executant) || "unassigned"
    const current = map.get(key) ?? {
      name: task.executant || "Unassigned",
      totalMinutes: 0,
      internalMinutes: 0,
    }
    current.totalMinutes += task.durationMinutes
    if (isInternalClient(task.client)) current.internalMinutes += task.durationMinutes
    map.set(key, current)
  }

  return Array.from(map.values())
    .map((entry) => ({
      executant: entry.name,
      totalMinutes: entry.totalMinutes,
      capacityMinutes: expectedCapacityMinutes,
      capacityPercent: expectedCapacityMinutes > 0 ? clampPercent((entry.totalMinutes / expectedCapacityMinutes) * 100) : 0,
      internalPercent: entry.totalMinutes > 0 ? clampPercent((entry.internalMinutes / entry.totalMinutes) * 100) : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
}

export function buildMyProjectsRows(
  tasks: TaskLog[],
  allocations: ClientAllocation[],
  selectedExecutant: string,
  startIso: string,
  endIso: string
): MyProjectRow[] {
  const allocationByClient = buildAllocationLookup(allocations)
  const rangeTasks = filterTasksByRange(tasks, startIso, endIso)
  const selectedExecutantKey = normalizeExecutantKey(selectedExecutant)
  const isAll = selectedExecutantKey === "all" || !selectedExecutantKey

  const relevantTaskScope = isAll
    ? rangeTasks
    : rangeTasks.filter((task) => normalizeExecutantKey(task.executant) === selectedExecutantKey)

  const clientsToInclude = new Set<string>()
  for (const task of relevantTaskScope) clientsToInclude.add(normalizeClientKey(task.client))
  if (!isAll) {
    for (const allocation of allocations) {
      if (normalizeExecutantKey(allocation.specialist) === selectedExecutantKey) {
        clientsToInclude.add(normalizeClientKey(allocation.client))
      }
    }
  } else {
    for (const allocation of allocations) clientsToInclude.add(normalizeClientKey(allocation.client))
  }

  const monthsInRange = Math.max(1, listMonthKeysBetween(startIso, endIso).length)
  const groupedTasks = new Map<string, TaskLog[]>()
  for (const task of relevantTaskScope) {
    const key = normalizeClientKey(task.client)
    const list = groupedTasks.get(key) ?? []
    list.push(task)
    groupedTasks.set(key, list)
  }

  const rows: MyProjectRow[] = []
  for (const key of clientsToInclude) {
    const tasksForClient = groupedTasks.get(key) ?? []
    const fallbackClientName = tasksForClient[0]?.client || allocationByClient.get(key)?.client || "Unknown Client"
    const allocation = allocationByClient.get(key)
    const totalMinutes = tasksForClient.reduce((sum, task) => sum + task.durationMinutes, 0)
    const datedTasks = tasksForClient.map((task) => task.date).filter((date): date is string => Boolean(date))
    const lastTaskDate = datedTasks.sort(sortIsoAsc)[datedTasks.length - 1] ?? null
    const avgMinutesPerMonth = totalMinutes / monthsInRange
    const hasTasks = tasksForClient.length > 0
    const workVolumeStatus = calculateWorkVolumeStatus(avgMinutesPerMonth, hasTasks, Boolean(allocation))

    rows.push({
      client: fallbackClientName,
      totalMinutes,
      lastTaskDate,
      workVolumeStatus,
      services: {
        seo: allocation?.seo ?? "-",
        gads: allocation?.gads ?? "-",
        fads: allocation?.fads ?? "-",
        tads: allocation?.tads ?? "-",
      },
    })
  }

  return rows.sort((a, b) => {
    if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes
    return a.client.localeCompare(b.client)
  })
}

export function buildClientExplorerRows(tasks: TaskLog[], startIso: string, endIso: string): ClientExplorerRow[] {
  const filtered = filterTasksByRange(tasks, startIso, endIso)
  const grouped = new Map<string, { client: string; tasks: number; totalMinutes: number; executants: Set<string>; latest: string | null }>()

  for (const task of filtered) {
    const key = normalizeClientKey(task.client)
    const current = grouped.get(key) ?? {
      client: task.client || "Unknown Client",
      tasks: 0,
      totalMinutes: 0,
      executants: new Set<string>(),
      latest: null as string | null,
    }
    current.tasks += 1
    current.totalMinutes += task.durationMinutes
    if (task.executant) current.executants.add(task.executant)
    if (task.date && (!current.latest || task.date > current.latest)) current.latest = task.date
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      client: entry.client,
      totalTasks: entry.tasks,
      totalMinutes: entry.totalMinutes,
      executants: Array.from(entry.executants).sort((a, b) => a.localeCompare(b)),
      latestTaskDate: entry.latest,
    }))
    .sort((a, b) => {
      if (a.latestTaskDate && b.latestTaskDate && a.latestTaskDate !== b.latestTaskDate) {
        return b.latestTaskDate.localeCompare(a.latestTaskDate)
      }
      return b.totalMinutes - a.totalMinutes
    })
}

export function formatHours(minutes: number, precision = 1) {
  return `${(minutes / 60).toFixed(precision)}h`
}

export function formatRecencyLabel(lastTaskDate: string | null) {
  if (!lastTaskDate) return "No tasks"
  const date = parseIsoDateToUtcDate(lastTaskDate)
  if (!date) return "No tasks"
  const now = new Date()
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const diffDays = Math.floor((nowUtc.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "1 day ago"
  return `${diffDays} days ago`
}
