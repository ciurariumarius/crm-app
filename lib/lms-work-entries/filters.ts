import type { Prisma } from "@prisma/client"
import { isValidDateOnly } from "@/lib/lms-work-entries/date"
import {
  LMS_WORK_ENTRY_ORIGINS,
  type LmsWorkEntryOrigin,
} from "@/lib/tasks/lms-bridge"

export const LMS_WORK_EXPORT_STATUSES = ["not-exported", "exported", "all"] as const
export const LMS_WORK_ORIGIN_FILTERS = ["all", ...LMS_WORK_ENTRY_ORIGINS] as const
export { LMS_WORK_ENTRY_ORIGINS }
export type { LmsWorkEntryOrigin }

export type LmsWorkExportStatus = (typeof LMS_WORK_EXPORT_STATUSES)[number]
export type LmsWorkOriginFilter = (typeof LMS_WORK_ORIGIN_FILTERS)[number]

export function normalizeLmsWorkExportStatus(value: string | null | undefined): LmsWorkExportStatus {
  return LMS_WORK_EXPORT_STATUSES.includes(value as LmsWorkExportStatus)
    ? value as LmsWorkExportStatus
    : "not-exported"
}

export function normalizeLmsWorkEntryOrigin(value: string | null | undefined): LmsWorkEntryOrigin {
  return LMS_WORK_ENTRY_ORIGINS.includes(value as LmsWorkEntryOrigin)
    ? value as LmsWorkEntryOrigin
    : "MANUAL"
}

export function normalizeLmsWorkOriginFilter(value: string | null | undefined): LmsWorkOriginFilter {
  return LMS_WORK_ORIGIN_FILTERS.includes(value as LmsWorkOriginFilter)
    ? value as LmsWorkOriginFilter
    : "all"
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
  origin,
  exportStatus,
}: {
  from: string | null
  to: string | null
  workDate?: string | null
  clientId?: string | null
  taskId?: string | null
  origin?: LmsWorkOriginFilter | null
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
    ...(origin && origin !== "all" ? { origin } : {}),
    ...(exportStatus === "not-exported" ? { exportedAt: null } : {}),
    ...(exportStatus === "exported" ? { exportedAt: { not: null } } : {}),
  }
}
