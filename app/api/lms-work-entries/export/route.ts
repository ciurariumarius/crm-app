import { NextRequest } from "next/server"
import { apiError, apiRouteError } from "@/lib/api-response"
import { logSessionAuditEvent } from "@/lib/audit"
import { normalizeDateRange } from "@/lib/lms-work-entries/date"
import { buildLmsCrmExportBuffer } from "@/lib/lms-work-entries/export"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function filenamePart(value: string | null, fallback: string) {
  return value?.replace(/[^0-9-]/g, "") || fallback
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantContext()
    const { from, to } = normalizeDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    )
    const entries = await prisma.lmsWorkEntry.findMany({
      where: {
        tenantId: session.tenantId,
        userId: session.userId,
        ...(from || to
          ? {
              workDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
      select: {
        workDate: true,
        clientDomainSnapshot: true,
        taskNameSnapshot: true,
        employeeNameSnapshot: true,
        durationMinutes: true,
      },
    })

    if (entries.length === 0) {
      return apiError("No work entries found for the selected date range", 404, {
        code: "NO_WORK_ENTRIES",
        headers: { "Cache-Control": "no-store" },
      })
    }

    const buffer = await buildLmsCrmExportBuffer(entries)
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
    const filename = `TASK_IMPORT_${filenamePart(from, "ALL")}_${filenamePart(to, "ALL")}_${timestamp}.xlsx`
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRIES_EXPORTED",
      details: `from=${from || "all"}; to=${to || "all"}; count=${entries.length}`,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return apiRouteError(error, {
      unauthorizedMessage: "Unauthorized",
      unauthorizedCode: "AUTH_REQUIRED",
      fallbackMessage: "Failed to export work entries",
      fallbackCode: "LMS_WORK_EXPORT_FAILED",
      headers: { "Cache-Control": "no-store" },
      logLabel: "LMS work export error:",
    })
  }
}

