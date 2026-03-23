import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { normalizeProjectStatus } from "@/lib/status"
import { formatProjectServiceList } from "@/lib/utils"
import { buildProjectWhereInput, normalizeProjectFilters } from "@/lib/filters/project-filters"
import { Prisma } from "@prisma/client"
import { apiRouteError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 300
const MAX_LIMIT = 1000
const PAGE_SIZE_OPTIONS = [100, 250, 500] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGINATION_THRESHOLD = 250
const PROJECT_SORT_VALUES = [
    "updated_desc",
    "created_desc",
    "created_asc",
    "amount_desc",
    "amount_asc",
    "time_desc",
    "time_asc",
    "name_asc",
    "name_desc",
] as const
type ProjectSortValue = (typeof PROJECT_SORT_VALUES)[number]
const DEFAULT_PROJECT_SORT: ProjectSortValue = "amount_desc"

function parseLimit(raw: string | null) {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
    return Math.min(Math.floor(parsed), MAX_LIMIT)
}

function parsePerPage(raw: string | null) {
    const parsed = Number(raw)
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : DEFAULT_PAGE_SIZE
}

function parsePage(raw: string | null) {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return 1
    return Math.floor(parsed)
}

function parseSort(raw: string | null): ProjectSortValue {
    if (!raw) return DEFAULT_PROJECT_SORT
    return PROJECT_SORT_VALUES.includes(raw as ProjectSortValue)
        ? (raw as ProjectSortValue)
        : DEFAULT_PROJECT_SORT
}

function resolveOrderBy(sort: ProjectSortValue): Prisma.ProjectOrderByWithRelationInput[] {
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

const projectInclude = {
    site: {
        include: {
            partner: true,
        },
    },
    services: true,
    tasks: {
        orderBy: { createdAt: "asc" as const },
        include: { timeLogs: true },
    },
    timeLogs: {
        orderBy: { startTime: "desc" as const },
        include: { task: true },
    },
    _count: {
        select: {
            tasks: true,
        },
    },
} satisfies Prisma.ProjectInclude

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>

export async function GET(request: Request) {
    try {
        const session = await requireTenantContext()
        const { searchParams } = new URL(request.url)
        const filters = normalizeProjectFilters({
            q: searchParams.get("q"),
            status: searchParams.get("status"),
            payment: searchParams.get("payment"),
            recurring: searchParams.get("recurring"),
            partnerId: searchParams.get("partnerId"),
            period: searchParams.get("period"),
            from: searchParams.get("from"),
            to: searchParams.get("to"),
        })
        const where = buildProjectWhereInput({
            tenantId: session.tenantId,
            filters,
            now: new Date(),
        })
        const limit = parseLimit(searchParams.get("limit"))
        const perPage = parsePerPage(searchParams.get("perPage"))
        const requestedPage = parsePage(searchParams.get("page"))
        const sort = parseSort(searchParams.get("sort"))
        const total = await prisma.project.count({ where })
        const shouldPaginate = total > PAGINATION_THRESHOLD
        const totalPages = shouldPaginate ? Math.max(1, Math.ceil(total / perPage)) : 1
        const page = shouldPaginate ? Math.min(requestedPage, totalPages) : 1
        const queryBase = {
            where,
            include: projectInclude,
            orderBy: resolveOrderBy(sort),
        }
        let projectsRaw: ProjectRow[] = []

        if (sort === "time_desc" || sort === "time_asc") {
            const candidates = await prisma.project.findMany({
                where,
                select: {
                    id: true,
                    updatedAt: true,
                    timeLogs: {
                        select: { durationSeconds: true },
                    },
                },
            })

            const sortedIds = candidates
                .map((candidate) => ({
                    id: candidate.id,
                    updatedAt: candidate.updatedAt,
                    secondsLogged: candidate.timeLogs.reduce((sum, log) => sum + Number(log.durationSeconds ?? 0), 0),
                }))
                .sort((a, b) => {
                    if (sort === "time_desc") {
                        if (b.secondsLogged !== a.secondsLogged) return b.secondsLogged - a.secondsLogged
                    } else {
                        if (a.secondsLogged !== b.secondsLogged) return a.secondsLogged - b.secondsLogged
                    }
                    if (b.updatedAt.getTime() !== a.updatedAt.getTime()) {
                        return b.updatedAt.getTime() - a.updatedAt.getTime()
                    }
                    return a.id.localeCompare(b.id)
                })
                .map((entry) => entry.id)

            const sliceStart = shouldPaginate ? (page - 1) * perPage : 0
            const sliceEnd = shouldPaginate ? sliceStart + perPage : Math.min(limit, MAX_LIMIT)
            const pageIds = sortedIds.slice(sliceStart, sliceEnd)

            if (pageIds.length > 0) {
                const rows: ProjectRow[] = await prisma.project.findMany({
                    ...queryBase,
                    where: {
                        ...where,
                        id: { in: pageIds },
                    },
                })
                const byId = new Map(rows.map((row) => [row.id, row] as const))
                projectsRaw = pageIds
                    .map((id) => byId.get(id))
                    .filter((project): project is ProjectRow => Boolean(project))
            }
        } else {
            projectsRaw = shouldPaginate
                ? await prisma.project.findMany({
                      ...queryBase,
                      skip: (page - 1) * perPage,
                      take: perPage,
                  })
                : await prisma.project.findMany({
                      ...queryBase,
                      take: Math.min(limit, MAX_LIMIT),
                  })
        }

        const projects = projectsRaw.map((project) => {
            const completedTasks = project.tasks.filter((task) => task.status === "Completed").length
            const secondsLogged = project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds ?? 0), 0)
            const isRecurring = project.services.some((service) => service.isRecurring)
            const serviceLabel = formatProjectServiceList(project.services, "No service")
            return {
                ...project,
                status: normalizeProjectStatus(project.status),
                completedTasks,
                secondsLogged,
                isRecurring,
                serviceLabel,
                amount: Number(project.currentFee ?? 0),
            }
        })
        const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1
        const pageEnd = shouldPaginate ? Math.min(page * perPage, total) : total
        const pagination = {
            total,
            page,
            perPage,
            totalPages,
            pageStart,
            pageEnd,
            shouldPaginate,
            prevPage: shouldPaginate && page > 1 ? page - 1 : null,
            nextPage: shouldPaginate && page < totalPages ? page + 1 : null,
        }

        return NextResponse.json(
            { success: true, total, projects, pagination },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to search projects",
            fallbackCode: "PROJECT_SEARCH_FAILED",
            headers: { "Cache-Control": "no-store" },
            logLabel: "API project search error:",
        })
    }
}
