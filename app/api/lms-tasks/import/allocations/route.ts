import { NextResponse } from "next/server"
import { z } from "zod"
import { apiRouteError } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { getLmsModuleData, syncLmsAllocations } from "@/lib/lms-tasks/db"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  records: z
    .array(
      z.object({
        client: z.string().default("Unknown Client"),
        specialist: z.string().default("Unassigned"),
        seo: z.enum(["Active", "Inactive", "Stopped", "-"]).default("-"),
        gads: z.enum(["Active", "Inactive", "Stopped", "-"]).default("-"),
        fads: z.enum(["Active", "Inactive", "Stopped", "-"]).default("-"),
        tads: z.enum(["Active", "Inactive", "Stopped", "-"]).default("-"),
      })
    )
    .max(50000),
  syncMode: z.enum(["replace", "merge"]).default("merge"),
})

export async function POST(request: Request) {
  try {
    await requireAuth()
    const parsed = bodySchema.parse(await request.json())
    const summary = await syncLmsAllocations(parsed.records, parsed.syncMode)
    const data = await getLmsModuleData()
    return NextResponse.json(
      { success: true, summary, data },
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
      fallbackMessage: "Failed to import LMS allocations",
      fallbackCode: "LMS_ALLOCATION_IMPORT_FAILED",
      headers: { "Cache-Control": "no-store" },
      logLabel: "API LMS allocation import error:",
    })
  }
}
