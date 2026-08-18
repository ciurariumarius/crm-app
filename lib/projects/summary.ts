import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { normalizeProjectStatus } from "@/lib/status"
import { formatProjectServiceList } from "@/lib/utils"

export type ProjectSummary = {
    id: string
    name: string | null
    status: string
    paymentStatus: string
    amount: number
    recurringBaseFee: number | null
    secondsLogged: number
    completedTasks: number
    createdAt: Date
    updatedAt: Date
    closedAt: Date | null
    isHeavyRevenueMonth: boolean
    isRecurring: boolean
    serviceLabel: string
    site: {
        domainName: string
        faviconUrl: string | null
        partner: {
            name: string
        }
    }
    _count: {
        tasks: number
    }
}

export type ProjectSummarySort =
    | "updated_desc"
    | "created_desc"
    | "created_asc"
    | "amount_desc"
    | "amount_asc"
    | "time_desc"
    | "time_asc"
    | "name_asc"
    | "name_desc"

const summarySelect = {
    id: true,
    name: true,
    status: true,
    paymentStatus: true,
    currentFee: true,
    recurringBaseFee: true,
    createdAt: true,
    updatedAt: true,
    closedAt: true,
    isHeavyRevenueMonth: true,
    site: {
        select: {
            domainName: true,
            faviconUrl: true,
            partner: { select: { name: true } },
        },
    },
    services: {
        select: {
            serviceName: true,
            isRecurring: true,
        },
    },
} satisfies Prisma.ProjectSelect

type SummaryRow = Prisma.ProjectGetPayload<{ select: typeof summarySelect }>

function resolveOrderBy(sort: ProjectSummarySort): Prisma.ProjectOrderByWithRelationInput[] {
    switch (sort) {
        case "created_desc":
            return [{ createdAt: "desc" }, { id: "asc" }]
        case "created_asc":
            return [{ createdAt: "asc" }, { id: "asc" }]
        case "amount_desc":
            return [{ currentFee: "desc" }, { id: "asc" }]
        case "amount_asc":
            return [{ currentFee: "asc" }, { id: "asc" }]
        case "name_asc":
            return [{ site: { domainName: "asc" } }, { id: "asc" }]
        case "name_desc":
            return [{ site: { domainName: "desc" } }, { id: "asc" }]
        case "updated_desc":
        default:
            return [{ updatedAt: "desc" }, { id: "asc" }]
    }
}

async function resolveOrderedProjectIds(args: {
    where: Prisma.ProjectWhereInput
    sort: ProjectSummarySort
    skip: number
    take: number
}) {
    if (args.sort !== "time_desc" && args.sort !== "time_asc") {
        const rows = await prisma.project.findMany({
            where: args.where,
            select: { id: true },
            orderBy: resolveOrderBy(args.sort),
            skip: args.skip,
            take: args.take,
        })
        return rows.map((row) => row.id)
    }

    const [projects, durations] = await Promise.all([
        prisma.project.findMany({
            where: args.where,
            select: { id: true, updatedAt: true },
        }),
        prisma.timeLog.groupBy({
            by: ["projectId"],
            where: { project: args.where },
            _sum: { durationSeconds: true },
        }),
    ])
    const secondsByProject = new Map(
        durations.map((row) => [row.projectId, Number(row._sum.durationSeconds ?? 0)])
    )

    return projects
        .map((project) => ({
            ...project,
            secondsLogged: secondsByProject.get(project.id) || 0,
        }))
        .sort((a, b) => {
            const durationDiff = args.sort === "time_desc"
                ? b.secondsLogged - a.secondsLogged
                : a.secondsLogged - b.secondsLogged
            if (durationDiff !== 0) return durationDiff
            const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime()
            return updatedDiff !== 0 ? updatedDiff : a.id.localeCompare(b.id)
        })
        .slice(args.skip, args.skip + args.take)
        .map((project) => project.id)
}

export async function getProjectSummaryPage(args: {
    where: Prisma.ProjectWhereInput
    sort: ProjectSummarySort
    page: number
    pageSize: number
    paginate: boolean
    limit: number
}) {
    const skip = args.paginate ? (args.page - 1) * args.pageSize : 0
    const take = args.paginate ? args.pageSize : args.limit
    const ids = await resolveOrderedProjectIds({
        where: args.where,
        sort: args.sort,
        skip,
        take,
    })
    if (!ids.length) return [] satisfies ProjectSummary[]

    const [rows, taskCounts, durations] = await Promise.all([
        prisma.project.findMany({
            where: { id: { in: ids } },
            select: summarySelect,
        }),
        prisma.task.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: ids } },
            _count: { _all: true },
        }),
        prisma.timeLog.groupBy({
            by: ["projectId"],
            where: { projectId: { in: ids } },
            _sum: { durationSeconds: true },
        }),
    ])

    const countsByProject = new Map<string, { total: number; completed: number }>()
    for (const row of taskCounts) {
        if (!row.projectId) continue
        const current = countsByProject.get(row.projectId) || { total: 0, completed: 0 }
        current.total += row._count._all
        if (row.status === "Completed") current.completed += row._count._all
        countsByProject.set(row.projectId, current)
    }
    const secondsByProject = new Map(
        durations.map((row) => [row.projectId, Number(row._sum.durationSeconds ?? 0)])
    )
    const rowById = new Map(rows.map((row) => [row.id, row] as const))

    return ids.flatMap((id) => {
        const row: SummaryRow | undefined = rowById.get(id)
        if (!row) return []
        const counts = countsByProject.get(id) || { total: 0, completed: 0 }
        return [{
            id: row.id,
            name: row.name,
            status: normalizeProjectStatus(row.status),
            paymentStatus: row.paymentStatus,
            amount: Number(row.currentFee ?? 0),
            recurringBaseFee: row.recurringBaseFee == null ? null : Number(row.recurringBaseFee),
            secondsLogged: secondsByProject.get(id) || 0,
            completedTasks: counts.completed,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            closedAt: row.closedAt,
            isHeavyRevenueMonth: row.isHeavyRevenueMonth,
            isRecurring: row.services.some((service) => service.isRecurring),
            serviceLabel: formatProjectServiceList(row.services, "No service"),
            site: row.site,
            _count: { tasks: counts.total },
        }]
    })
}
