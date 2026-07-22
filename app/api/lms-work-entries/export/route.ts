import { NextRequest } from "next/server"
import { ActionError } from "@/lib/action-errors"
import { apiError, apiRouteError } from "@/lib/api-response"
import { logSessionAuditEvent } from "@/lib/audit"
import { normalizeDateRange } from "@/lib/lms-work-entries/date"
import { buildLmsCrmExportBuffer } from "@/lib/lms-work-entries/export"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function filenamePart(value: string | null, fallback: string) {
  return value?.replace(/[^0-9-]/g, "") || fallback
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { from, to } = normalizeDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    )
    const includeExported = request.nextUrl.searchParams.get("includeExported") === "true"
    const entries = await prisma.lmsWorkEntry.findMany({
      where: {
        ...(includeExported ? {} : { exportedAt: null }),
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
        id: true,
        workDate: true,
        clientDomainSnapshot: true,
        taskNameSnapshot: true,
        employeeNameSnapshot: true,
        durationMinutes: true,
      },
    })

    if (entries.length === 0) {
      return apiError(includeExported
        ? "No work entries found for the selected date range"
        : "No unexported work entries found for the selected date range", 404, {
        code: includeExported ? "NO_WORK_ENTRIES" : "NO_UNEXPORTED_WORK_ENTRIES",
        headers: { "Cache-Control": "no-store" },
      })
    }

    const buffer = await buildLmsCrmExportBuffer(entries)
    const exportedAt = new Date()
    await prisma.$transaction(async (tx) => {
      let updatedCount = 0
      for (let offset = 0; offset < entries.length; offset += 500) {
        const result = await tx.lmsWorkEntry.updateMany({
          where: {
            id: { in: entries.slice(offset, offset + 500).map((entry) => entry.id) },
            ...(includeExported ? {} : { exportedAt: null }),
          },
          data: { exportedAt },
        })
        updatedCount += result.count
      }
      if (updatedCount !== entries.length) {
        throw new ActionError(
          "LMS_WORK_EXPORT_CONFLICT",
          "Some entries were exported in another request. Refresh and export again."
        )
      }
    })
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
    const filename = `TASK_IMPORT_${filenamePart(from, "ALL")}_${filenamePart(to, "ALL")}_${timestamp}.xlsx`
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRIES_EXPORTED",
      details: `from=${from || "all"}; to=${to || "all"}; count=${entries.length}; mode=${includeExported ? "all" : "new"}`,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Exported-Entry-Count": String(entries.length),
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
