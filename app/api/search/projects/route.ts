import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { buildProjectWhereInput, normalizeProjectFilters } from "@/lib/filters/project-filters"
import { apiRouteError } from "@/lib/api-response"
import { getProjectSummaryPage, type ProjectSummarySort } from "@/lib/projects/summary"

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

export async function GET(request: Request) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const filters = normalizeProjectFilters({
            q: searchParams.get("q"),
            projectId: searchParams.get("projectId"),
            status: searchParams.get("status"),
            payment: searchParams.get("payment"),
            recurring: searchParams.get("recurring"),
            partnerId: searchParams.get("partnerId"),
            period: searchParams.get("period"),
            from: searchParams.get("from"),
            to: searchParams.get("to"),
        })
        const where = buildProjectWhereInput({
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
        const projects = await getProjectSummaryPage({
            where,
            sort: sort as ProjectSummarySort,
            page,
            pageSize: perPage,
            paginate: shouldPaginate,
            limit: Math.min(limit, MAX_LIMIT),
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
