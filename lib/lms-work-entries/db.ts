import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { normalizeDateRange } from "@/lib/lms-work-entries/date"
import type { LmsWorkLogPageData } from "@/lib/lms-work-entries/types"

const DEFAULT_PAGE_SIZE = 50

async function findLmsWorkTasksForTenant(tenantId: string) {
  return prisma.lmsWorkTask.findMany({
    where: { tenantId },
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })
}

export async function getLmsWorkTaskOptions() {
  const session = await requireTenantContext()
  return findLmsWorkTasksForTenant(session.tenantId)
}

export async function getLmsWorkLogPageData(args?: {
  from?: string | null
  to?: string | null
  page?: number
  pageSize?: number
}): Promise<LmsWorkLogPageData> {
  const session = await requireTenantContext()
  const { from, to } = normalizeDateRange(args?.from, args?.to)
  const pageSize = Math.min(100, Math.max(1, Math.trunc(args?.pageSize ?? DEFAULT_PAGE_SIZE)))
  const requestedPage = Math.max(1, Math.trunc(args?.page ?? 1))
  const dateFilter = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  }
  const where = {
    tenantId: session.tenantId,
    userId: session.userId,
    ...(from || to ? { workDate: dateFilter } : {}),
  }

  const [clients, tasks, totalEntries, aggregate] = await Promise.all([
    prisma.lmsAllocation.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, client: true },
      orderBy: { client: "asc" },
    }),
    findLmsWorkTasksForTenant(session.tenantId),
    prisma.lmsWorkEntry.count({ where }),
    prisma.lmsWorkEntry.aggregate({ where, _sum: { durationMinutes: true } }),
  ])

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
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    clients,
    tasks,
    entries: entries.map((entry) => ({
      id: entry.id,
      lmsAllocationId: entry.lmsAllocationId,
      taskTypeId: entry.taskTypeId,
      workDate: entry.workDate,
      durationMinutes: entry.durationMinutes,
      clientDomain: entry.clientDomainSnapshot,
      taskName: entry.taskNameSnapshot,
      employeeName: entry.employeeNameSnapshot,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    totalEntries,
    totalMinutes: aggregate._sum.durationMinutes ?? 0,
    page,
    pageSize,
    totalPages,
    from,
    to,
  }
}
