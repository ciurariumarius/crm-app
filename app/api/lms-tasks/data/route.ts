import { NextResponse } from "next/server"
import { requireTenantContext } from "@/lib/tenant"
import { apiRouteError } from "@/lib/api-response"
import { getLmsModuleDataForTenant } from "@/lib/lms-tasks/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requireTenantContext()
    const data = await getLmsModuleDataForTenant(session.tenantId)
    return NextResponse.json(
      { success: true, data },
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
