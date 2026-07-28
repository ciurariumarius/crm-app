import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { apiRouteError } from "@/lib/api-response"
import { getLmsModuleDataPage } from "@/lib/lms-tasks/db"

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
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 500, 500)
    const data = await getLmsModuleDataPage({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      q: searchParams.get("q"),
      page,
      pageSize,
      includeAllocations: searchParams.get("includeAllocations") === "1",
    })
    return NextResponse.json(
      { success: true, ...data },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    return apiRouteError(error, {
      unauthorizedMessage: "Unauthorized",
      unauthorizedCode: "AUTH_REQUIRED",
      fallbackMessage: "Failed to fetch LMS module data",
      fallbackCode: "LMS_DATA_FETCH_FAILED",
      headers: { "Cache-Control": "no-store" },
      logLabel: "API LMS data fetch error:",
    })
  }
}
