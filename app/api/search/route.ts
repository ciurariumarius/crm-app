import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { apiRouteError } from "@/lib/api-response"
import { executeGlobalSearch } from "@/lib/search/global-search-core"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const q = searchParams.get("q") || ""
        const results = await executeGlobalSearch(q)

        return NextResponse.json(
            { success: true, ...results },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to perform global search",
            fallbackCode: "GLOBAL_SEARCH_FAILED",
            headers: { "Cache-Control": "no-store" },
            logLabel: "API global search error:",
        })
    }
}
