import { NextResponse } from "next/server"
import { z } from "zod"
import { apiRouteError } from "@/lib/api-response"
import { requireTenantContext } from "@/lib/tenant"
import { getLmsModuleDataForTenant, syncLmsTasksForTenant } from "@/lib/lms-tasks/db"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  records: z
    .array(
      z.object({
        id: z.string().default(""),
        date: z.string().nullable().default(null),
        client: z.string().default("Unknown Client"),
        taskName: z.string().default("Untitled Task"),
        executant: z.string().default("Unassigned"),
        durationMinutes: z.number().int().nonnegative().default(0),
        status: z.string().default("-"),
      })
    )
    .max(50000),
  syncMode: z.enum(["replace", "merge"]).default("merge"),
})

export async function POST(request: Request) {
  try {
    const session = await requireTenantContext()
    const parsed = bodySchema.parse(await request.json())
    const summary = await syncLmsTasksForTenant(session.tenantId, parsed.records, parsed.syncMode)
    const data = await getLmsModuleDataForTenant(session.tenantId)
    return NextResponse.json(
      { success: true, summary, data },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    const errorSuffix = error instanceof Error && error.message ? `: ${error.message}` : ""
    return apiRouteError(error, {
      unauthorizedMessage: "Unauthorized",
      unauthorizedCode: "AUTH_REQUIRED",
      fallbackMessage: `Failed to import LMS tasks${errorSuffix}`,
      fallbackCode: "LMS_TASK_IMPORT_FAILED",
      headers: { "Cache-Control": "no-store" },
      logLabel: "API LMS task import error:",
    })
  }
}
