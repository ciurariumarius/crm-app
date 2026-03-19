import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "@/lib/filters/task-filters"
import { Prisma } from "@prisma/client"
import { apiRouteError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 300
const MAX_LIMIT = 1000
const PAGE_SIZE_OPTIONS = [100, 250, 500] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGINATION_THRESHOLD = 200

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

function buildSort(sort: string): Prisma.TaskOrderByWithRelationInput[] {
    switch (sort) {
        case "oldest":
            return [{ createdAt: "asc" }]
        case "updated":
            return [{ updatedAt: "desc" }]
        case "name_asc":
            return [{ name: "asc" }]
        case "name_desc":
            return [{ name: "desc" }]
        case "newest":
        default:
            return [{ createdAt: "desc" }]
    }
}

export async function GET(request: Request) {
    try {
        const session = await requireTenantContext()
        const { searchParams } = new URL(request.url)
        const filters = normalizeTaskFilters({
            q: searchParams.get("q"),
            status: searchParams.get("status"),
            partnerId: searchParams.get("partnerId"),
            projectId: searchParams.get("projectId"),
            urgency: searchParams.get("urgency"),
            overdue: searchParams.get("overdue"),
            dueToday: searchParams.get("dueToday"),
        })
        const { todayStart, todayEnd } = getLocalDayBounds(new Date())
        const where = buildTaskWhereInput({
            tenantId: session.tenantId,
            filters,
            todayStart,
            todayEnd,
        })
        const limit = parseLimit(searchParams.get("limit"))
        const perPage = parsePerPage(searchParams.get("perPage"))
        const requestedPage = parsePage(searchParams.get("page"))
        const sort = searchParams.get("sort") || "newest"
        const total = await prisma.task.count({ where })
        const shouldPaginate = total > PAGINATION_THRESHOLD
        const totalPages = shouldPaginate ? Math.max(1, Math.ceil(total / perPage)) : 1
        const page = shouldPaginate ? Math.min(requestedPage, totalPages) : 1
        const queryBase = {
            where,
            include: {
                project: {
                    include: {
                        services: true,
                        site: {
                            include: {
                                partner: true,
                            },
                        },
                    },
                },
                timeLogs: true,
            },
            orderBy: buildSort(sort),
        }
        const tasksRaw = shouldPaginate
            ? await prisma.task.findMany({
                  ...queryBase,
                  skip: (page - 1) * perPage,
                  take: perPage,
              })
            : await prisma.task.findMany({
                  ...queryBase,
                  take: Math.min(limit, MAX_LIMIT),
              })

        const tasks = tasksRaw.map((task) => ({
            ...task,
            status: normalizeTaskStatus(task.status),
            urgency: normalizeTaskUrgency(task.urgency),
        }))
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
            { success: true, total, tasks, pagination },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to search tasks",
            fallbackCode: "TASK_SEARCH_FAILED",
            headers: { "Cache-Control": "no-store" },
            logLabel: "API task search error:",
        })
    }
}
