import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { apiRouteError } from "@/lib/api-response"
import type { ClientAllocation } from "@/lib/lms-tasks/types"

export const dynamic = "force-dynamic"

function parsePositiveInt(value: string | null, fallback: number, max: number) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) return fallback
    return Math.min(parsed, max)
}

export async function GET(request: Request) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const page = parsePositiveInt(searchParams.get("page"), 1, 10_000)
        const pageSize = parsePositiveInt(searchParams.get("pageSize"), 250, 250)
        const q = searchParams.get("q")?.trim().slice(0, 100) || ""
        const where = q
            ? {
                OR: [
                    { client: { contains: q } },
                    { specialist: { contains: q } },
                ],
            }
            : undefined
        const [rows, total] = await Promise.all([
            prisma.lmsAllocation.findMany({
                where,
                orderBy: { client: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.lmsAllocation.count({ where }),
        ])

        return NextResponse.json(
            {
                success: true,
                rows: rows.map((row) => ({
                    client: row.client,
                    specialist: row.specialist,
                    seo: row.seo as ClientAllocation["seo"],
                    gads: row.gads as ClientAllocation["gads"],
                    fads: row.fads as ClientAllocation["fads"],
                    tads: row.tads as ClientAllocation["tads"],
                })),
                page,
                pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / pageSize)),
            },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to fetch LMS allocations",
            fallbackCode: "LMS_ALLOCATIONS_FETCH_FAILED",
            headers: { "Cache-Control": "no-store" },
            logLabel: "[lms-tasks/allocations] failed",
        })
    }
}
