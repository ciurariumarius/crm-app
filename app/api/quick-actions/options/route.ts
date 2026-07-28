import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { apiRouteError } from "@/lib/api-response"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"

export const dynamic = "force-dynamic"

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value: string | null, fallback: number, max: number) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) return fallback
    return Math.min(parsed, max)
}

export async function GET(request: Request) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q")?.trim().slice(0, 100) || ""
        const page = parsePositiveInt(searchParams.get("page"), 1, 10_000)
        const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
        const where = q
            ? {
                OR: [
                    { name: { contains: q } },
                    { site: { domainName: { contains: q } } },
                ],
            }
            : undefined

        const [partners, services, projects, totalProjects] = await Promise.all([
            prisma.partner.findMany({
                include: {
                    sites: {
                        select: { id: true, domainName: true },
                        orderBy: { domainName: "asc" },
                    },
                },
                orderBy: { name: "asc" },
            }),
            prisma.service.findMany({ orderBy: { serviceName: "asc" } }),
            prisma.project.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    site: { select: { domainName: true } },
                    services: {
                        select: { serviceName: true, isRecurring: true },
                    },
                },
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.project.count({ where }),
        ])

        return NextResponse.json(
            {
                success: true,
                data: {
                    partners,
                    services,
                    projects: projects.map((project) => ({
                        id: project.id,
                        status: normalizeProjectStatus(project.status),
                        createdAt: project.createdAt,
                        site: project.site ? { domainName: project.site.domainName } : undefined,
                        services: project.services,
                        siteName: formatProjectName({
                            site: project.site ? { domainName: project.site.domainName } : undefined,
                            services: project.services,
                            createdAt: project.createdAt,
                        }),
                    })),
                    pagination: {
                        page,
                        pageSize,
                        total: totalProjects,
                        totalPages: Math.max(1, Math.ceil(totalProjects / pageSize)),
                    },
                },
            },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to load quick action options",
            fallbackCode: "QUICK_ACTION_OPTIONS_FAILED",
            headers: { "Cache-Control": "no-store" },
            logLabel: "[quick-actions/options] failed",
        })
    }
}
