import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { apiError } from "@/lib/api-response"
import { matchesBearerOrHeaderSecret } from "@/lib/http-auth"

const DEBUG_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Robots-Tag": "noindex, nofollow",
}

function isAuthorized(request: Request) {
    const allowInProduction = process.env.DEBUG_API_ALLOW_PRODUCTION === "true"
    if (process.env.NODE_ENV === "production" && !allowInProduction) return false
    if (process.env.DEBUG_API_ENABLED !== "true") return false
    const secret = process.env.DEBUG_API_SECRET?.trim()
    if (!secret) return false
    return matchesBearerOrHeaderSecret(request, secret, "x-debug-secret")
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return apiError("Not found", 404, { code: "DEBUG_UNAVAILABLE", headers: DEBUG_HEADERS })
    }

    const debugInfo: Record<string, unknown> = {}

    try {
        const tables = await prisma.$queryRaw<Array<{ name: string }>>`
            SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
        `
        debugInfo.tables = tables.map(r => r.name)

        const projsInfo = await prisma.$queryRaw<Array<{ name: string; type: string }>>`PRAGMA table_info(projects)`
        debugInfo.projects_columns = projsInfo.map(c => `${c.name} (${c.type})`)

        const tasksInfo = await prisma.$queryRaw<Array<{ name: string; type: string }>>`PRAGMA table_info(tasks)`
        debugInfo.tasks_columns = tasksInfo.map(c => `${c.name} (${c.type})`)

        const userCount = await prisma.$queryRaw<Array<{ count: bigint | number }>>`SELECT COUNT(*) as count FROM users`
        debugInfo.user_count = userCount[0].count
    } catch {
        return apiError("Failed to load debug info", 500, {
            code: "DEBUG_QUERY_FAILED",
            headers: DEBUG_HEADERS,
        })
    }

    const responseText = JSON.stringify(debugInfo, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
        2
    )

    return new NextResponse(
        responseText,
        { headers: { "Content-Type": "application/json", ...DEBUG_HEADERS } }
    )
}
