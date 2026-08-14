import { NextRequest } from "next/server"
import { ActionError } from "@/lib/action-errors"
import { apiError, apiRouteError } from "@/lib/api-response"
import { logSessionAuditEvent } from "@/lib/audit"
import { normalizeDateRange } from "@/lib/lms-work-entries/date"
import { buildLmsCrmExportBuffer } from "@/lib/lms-work-entries/export"
import {
  LMS_WORK_ORIGIN_FILTERS,
  buildLmsWorkEntryWhere,
  normalizeLmsWorkDateFilter,
  normalizeLmsWorkExportStatus,
  normalizeLmsWorkOriginFilter,
} from "@/lib/lms-work-entries/filters"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SelectedExportSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(128)).min(1).max(250),
  origin: z.enum(LMS_WORK_ORIGIN_FILTERS).optional(),
})

const exportEntrySelect = {
  id: true,
  workDate: true,
  clientDomainSnapshot: true,
  taskNameSnapshot: true,
  employeeNameSnapshot: true,
  durationMinutes: true,
  updatedAt: true,
} satisfies Prisma.LmsWorkEntrySelect

function filenamePart(value: string | null, fallback: string) {
  return value?.replace(/[^0-9-]/g, "") || fallback
}

function exportTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

async function exportEntries({
  session,
  where,
  filename,
  auditDetails,
  requireUnexported,
  expectedCount,
  emptyMessage,
  emptyCode,
}: {
  session: Awaited<ReturnType<typeof requireAuth>>
  where: Prisma.LmsWorkEntryWhereInput
  filename: string
  auditDetails: string
  requireUnexported: boolean
  expectedCount?: number
  emptyMessage: string
  emptyCode: string
}) {
  const entries = await prisma.lmsWorkEntry.findMany({
    where,
    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    select: exportEntrySelect,
  })

  if (expectedCount !== undefined && entries.length !== expectedCount) {
    return apiError("Some selected work entries are no longer available. Refresh and select them again.", 409, {
      code: "LMS_WORK_SELECTION_STALE",
      headers: { "Cache-Control": "no-store" },
    })
  }
  if (entries.length === 0) {
    return apiError(emptyMessage, 404, {
      code: emptyCode,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const buffer = await buildLmsCrmExportBuffer(entries)
  const exportedAt = new Date()
  await prisma.$transaction(async (tx) => {
    let updatedCount = 0
    for (let offset = 0; offset < entries.length; offset += 500) {
      const chunk = entries.slice(offset, offset + 500)
      const result = await tx.lmsWorkEntry.updateMany({
        where: {
          OR: chunk.map((entry) => ({ id: entry.id, updatedAt: entry.updatedAt })),
          ...(requireUnexported ? { exportedAt: null } : {}),
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

  await logSessionAuditEvent(session, {
    action: "LMS_WORK_ENTRIES_EXPORTED",
    details: `${auditDetails}; count=${entries.length}`,
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
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { from, to } = normalizeDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    )
    const clientId = request.nextUrl.searchParams.get("client")?.trim() || null
    const taskId = request.nextUrl.searchParams.get("task")?.trim() || null
    const workDate = normalizeLmsWorkDateFilter(request.nextUrl.searchParams.get("date"), from, to)
    const exportStatus = normalizeLmsWorkExportStatus(request.nextUrl.searchParams.get("exportStatus"))
    const origin = normalizeLmsWorkOriginFilter(request.nextUrl.searchParams.get("origin"))
    const includeExported = request.nextUrl.searchParams.get("includeExported") === "true"
    const entryFilter = buildLmsWorkEntryWhere({ from, to, workDate, clientId, taskId, origin })
    const where: Prisma.LmsWorkEntryWhereInput = {
      ...entryFilter,
      ...(includeExported
        ? exportStatus === "exported" ? { exportedAt: { not: null } } : {}
        : { exportedAt: null }),
    }
    const filename = `TASK_IMPORT_${filenamePart(from, "ALL")}_${filenamePart(to, "ALL")}_${exportTimestamp()}.xlsx`
    return await exportEntries({
      session,
      where,
      filename,
      auditDetails: `from=${from || "all"}; to=${to || "all"}; date=${workDate || "all"}; client=${clientId || "all"}; task=${taskId || "all"}; origin=${origin}; exportStatus=${exportStatus}; mode=${includeExported ? "all" : "new"}`,
      requireUnexported: !includeExported,
      emptyMessage: includeExported
        ? "No work entries found for the selected filters"
        : "No unexported work entries found for the selected filters",
      emptyCode: includeExported ? "NO_WORK_ENTRIES" : "NO_UNEXPORTED_WORK_ENTRIES",
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const payload = await request.json().catch(() => null)
    const parsed = SelectedExportSchema.safeParse(payload)
    if (!parsed.success) {
      return apiError("Select between 1 and 250 valid work entries to export.", 400, {
        code: "INVALID_LMS_WORK_SELECTION",
        headers: { "Cache-Control": "no-store" },
      })
    }

    const ids = Array.from(new Set(parsed.data.ids))
    const origin = normalizeLmsWorkOriginFilter(parsed.data.origin)
    const originWhere = buildLmsWorkEntryWhere({
      from: null,
      to: null,
      origin,
    })
    return await exportEntries({
      session,
      where: { id: { in: ids }, ...originWhere },
      filename: `TASK_IMPORT_SELECTED_${exportTimestamp()}.xlsx`,
      auditDetails: `mode=selected; origin=${origin}`,
      requireUnexported: false,
      expectedCount: ids.length,
      emptyMessage: "No selected work entries found",
      emptyCode: "NO_SELECTED_WORK_ENTRIES",
    })
  } catch (error) {
    return apiRouteError(error, {
      unauthorizedMessage: "Unauthorized",
      unauthorizedCode: "AUTH_REQUIRED",
      fallbackMessage: "Failed to export selected work entries",
      fallbackCode: "LMS_WORK_SELECTED_EXPORT_FAILED",
      headers: { "Cache-Control": "no-store" },
      logLabel: "LMS selected work export error:",
    })
  }
}
