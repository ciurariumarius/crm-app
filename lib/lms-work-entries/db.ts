import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { normalizeDateRange } from "@/lib/lms-work-entries/date"
import { buildLmsWorkDurationShortcuts } from "@/lib/lms-work-entries/duration-options"
import {
  buildLmsWorkEntryWhere,
  normalizeLmsWorkDateFilter,
  normalizeLmsWorkExportStatus,
} from "@/lib/lms-work-entries/filters"
import type { LmsWorkExportStatus } from "@/lib/lms-work-entries/filters"
import { rankLmsWorkOptionsByFrequency } from "@/lib/lms-work-entries/frequent-options"
import { normalizeLmsWorkLogPageSize } from "@/lib/lms-work-entries/pagination"
import { maskToWeekdays } from "@/lib/lms-work-entries/recurrence"
import type { LmsWorkLogPageData, LmsWorkRecurrencePageData } from "@/lib/lms-work-entries/types"

async function findLmsWorkTasks() {
  return prisma.lmsWorkTask.findMany({
    select: { id: true, name: true, isActive: true, defaultDurationMinutes: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function getLmsWorkTaskOptions() {
  await requireAuth()
  return findLmsWorkTasks()
}

export async function getLmsWorkRecurrencePageData(): Promise<LmsWorkRecurrencePageData> {
  await requireAuth()
  const [clients, tasks, recurrences] = await Promise.all([
    prisma.lmsAllocation.findMany({
      select: { id: true, client: true },
      orderBy: { client: "asc" },
    }),
    findLmsWorkTasks(),
    prisma.lmsWorkRecurrence.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        lmsAllocationId: true,
        taskTypeId: true,
        clientSnapshot: true,
        taskSnapshot: true,
        durationMinutes: true,
        weekdayMask: true,
        isActive: true,
        startsOn: true,
        processedThrough: true,
        lastRunAt: true,
        lmsAllocation: { select: { id: true } },
        taskType: { select: { isActive: true } },
      },
    }),
  ])

  return {
    clients,
    tasks,
    recurrences: recurrences.map((recurrence) => ({
      id: recurrence.id,
      lmsAllocationId: recurrence.lmsAllocationId,
      taskTypeId: recurrence.taskTypeId,
      clientName: recurrence.clientSnapshot,
      taskName: recurrence.taskSnapshot,
      durationMinutes: recurrence.durationMinutes,
      weekdays: maskToWeekdays(recurrence.weekdayMask),
      isActive: recurrence.isActive,
      startsOn: recurrence.startsOn,
      processedThrough: recurrence.processedThrough,
      lastRunAt: recurrence.lastRunAt?.toISOString() ?? null,
      clientDetached: recurrence.lmsAllocation === null,
      taskInactive: !recurrence.taskType.isActive,
    })),
  }
}

export async function getLmsWorkLogPageData(args?: {
  from?: string | null
  to?: string | null
  clientId?: string | null
  taskId?: string | null
  workDate?: string | null
  exportStatus?: LmsWorkExportStatus | null
  page?: number
  pageSize?: number
}): Promise<LmsWorkLogPageData> {
  await requireAuth()
  const { from, to } = normalizeDateRange(args?.from, args?.to)
  const clientId = args?.clientId?.trim() || null
  const taskId = args?.taskId?.trim() || null
  const workDate = normalizeLmsWorkDateFilter(args?.workDate, from, to)
  const exportStatus = normalizeLmsWorkExportStatus(args?.exportStatus)
  const pageSize = normalizeLmsWorkLogPageSize(args?.pageSize)
  const requestedPage = Math.max(1, Math.trunc(args?.page ?? 1))
  const allMatchingWhere = buildLmsWorkEntryWhere({ from, to, workDate, clientId, taskId })
  const where = buildLmsWorkEntryWhere({ from, to, workDate, clientId, taskId, exportStatus })
  const dateFilterWhere = buildLmsWorkEntryWhere({ from, to, clientId, taskId, exportStatus })
  const clientFilterWhere = buildLmsWorkEntryWhere({ from, to, workDate, taskId, exportStatus })
  const taskFilterWhere = buildLmsWorkEntryWhere({ from, to, workDate, clientId, exportStatus })

  const [
    clients,
    tasks,
    totalEntries,
    allMatchingEntries,
    unexportedEntries,
    aggregate,
    workedDates,
    durationFrequencies,
    clientFrequencies,
    taskFrequencies,
    dateFilterRows,
    clientFilterRows,
    taskFilterRows,
  ] = await Promise.all([
    prisma.lmsAllocation.findMany({
      select: { id: true, client: true },
      orderBy: { client: "asc" },
    }),
    findLmsWorkTasks(),
    prisma.lmsWorkEntry.count({ where }),
    prisma.lmsWorkEntry.count({ where: allMatchingWhere }),
    prisma.lmsWorkEntry.count({ where: { ...where, exportedAt: null } }),
    prisma.lmsWorkEntry.aggregate({
      where,
      _sum: { durationMinutes: true },
      _min: { workDate: true },
      _max: { workDate: true },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["workDate"],
      where,
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["durationMinutes"],
      _count: { _all: true },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["lmsAllocationId"],
      where: {
        lmsAllocationId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["taskTypeId"],
      _count: { _all: true },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["workDate"],
      where: dateFilterWhere,
      orderBy: { workDate: "desc" },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["lmsAllocationId", "clientDomainSnapshot"],
      where: {
        ...clientFilterWhere,
        lmsAllocationId: { not: null },
      },
    }),
    prisma.lmsWorkEntry.groupBy({
      by: ["taskTypeId", "taskNameSnapshot"],
      where: taskFilterWhere,
    }),
  ])

  const frequentClients = rankLmsWorkOptionsByFrequency(
    clients,
    clientFrequencies.map((frequency) => ({
      id: frequency.lmsAllocationId,
      count: frequency._count._all,
    })),
    (client) => client.client
  )
  const frequentTasks = rankLmsWorkOptionsByFrequency(
    tasks.filter((task) => task.isActive),
    taskFrequencies.map((frequency) => ({
      id: frequency.taskTypeId,
      count: frequency._count._all,
    })),
    (task) => task.name
  )
  const clientFilterOptions = Array.from(
    new Map(
      clientFilterRows.map((row) => [
        row.lmsAllocationId as string,
        { id: row.lmsAllocationId as string, label: row.clientDomainSnapshot },
      ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label, "ro"))
  const taskFilterOptions = Array.from(
    new Map(
      taskFilterRows.map((row) => [
        row.taskTypeId,
        { id: row.taskTypeId, label: row.taskNameSnapshot },
      ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label, "ro"))

  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const entries = await prisma.lmsWorkEntry.findMany({
    where,
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      lmsAllocationId: true,
      taskTypeId: true,
      workDate: true,
      durationMinutes: true,
      clientDomainSnapshot: true,
      taskNameSnapshot: true,
      employeeNameSnapshot: true,
      exportedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    clients,
    tasks,
    frequentClients,
    frequentTasks,
    frequentDurations: buildLmsWorkDurationShortcuts(
      durationFrequencies.map((frequency) => ({
        durationMinutes: frequency.durationMinutes,
        count: frequency._count._all,
      }))
    ),
    dateFilterOptions: dateFilterRows.map((row) => row.workDate),
    clientFilterOptions,
    taskFilterOptions,
    entries: entries.map((entry) => ({
      id: entry.id,
      lmsAllocationId: entry.lmsAllocationId,
      taskTypeId: entry.taskTypeId,
      workDate: entry.workDate,
      durationMinutes: entry.durationMinutes,
      clientDomain: entry.clientDomainSnapshot,
      taskName: entry.taskNameSnapshot,
      employeeName: entry.employeeNameSnapshot,
      exportedAt: entry.exportedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    totalEntries,
    allMatchingEntries,
    unexportedEntries,
    totalMinutes: aggregate._sum.durationMinutes ?? 0,
    workedDays: workedDates.length,
    firstWorkDate: aggregate._min.workDate,
    lastWorkDate: aggregate._max.workDate,
    page,
    pageSize,
    totalPages,
    from,
    to,
    workDate,
    clientId,
    taskId,
    exportStatus,
  }
}
