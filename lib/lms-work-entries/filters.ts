import type { Prisma } from "@prisma/client"
import { isValidDateOnly } from "@/lib/lms-work-entries/date"

export const LMS_WORK_EXPORT_STATUSES = ["not-exported", "exported", "all"] as const

export type LmsWorkExportStatus = (typeof LMS_WORK_EXPORT_STATUSES)[number]

export function normalizeLmsWorkExportStatus(value: string | null | undefined): LmsWorkExportStatus {
  return LMS_WORK_EXPORT_STATUSES.includes(value as LmsWorkExportStatus)
    ? value as LmsWorkExportStatus
    : "not-exported"
}

export function normalizeLmsWorkDateFilter(
  value: string | null | undefined,
  from?: string | null,
  to?: string | null
): string | null {
  const normalized = value?.trim() || ""
  if (!isValidDateOnly(normalized)) return null
  if (from && normalized < from) return null
  if (to && normalized > to) return null
  return normalized
}

export function buildLmsWorkEntryWhere({
  from,
  to,
  workDate,
  clientId,
  taskId,
  exportStatus,
}: {
  from: string | null
  to: string | null
  workDate?: string | null
  clientId?: string | null
  taskId?: string | null
  exportStatus?: LmsWorkExportStatus | null
}): Prisma.LmsWorkEntryWhereInput {
  const normalizedClientId = clientId?.trim() || null
  const normalizedTaskId = taskId?.trim() || null
  const normalizedWorkDate = normalizeLmsWorkDateFilter(workDate, from, to)

  return {
    ...(normalizedWorkDate
      ? { workDate: normalizedWorkDate }
      : from || to
      ? {
          workDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(normalizedClientId ? { lmsAllocationId: normalizedClientId } : {}),
    ...(normalizedTaskId ? { taskTypeId: normalizedTaskId } : {}),
    ...(exportStatus === "not-exported" ? { exportedAt: null } : {}),
    ...(exportStatus === "exported" ? { exportedAt: { not: null } } : {}),
  }
}
