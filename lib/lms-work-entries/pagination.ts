export const LMS_WORK_LOG_PAGE_SIZES = [50, 100, 250] as const

export type LmsWorkLogPageSize = (typeof LMS_WORK_LOG_PAGE_SIZES)[number]

export const DEFAULT_LMS_WORK_LOG_PAGE_SIZE: LmsWorkLogPageSize = LMS_WORK_LOG_PAGE_SIZES[0]

const PAGE_SIZE_VALUES = new Set<number>(LMS_WORK_LOG_PAGE_SIZES)

export function normalizeLmsWorkLogPageSize(
  value: number | string | null | undefined
): LmsWorkLogPageSize {
  const parsed = typeof value === "number" ? Math.trunc(value) : Number.parseInt(value || "", 10)
  return PAGE_SIZE_VALUES.has(parsed) ? parsed as LmsWorkLogPageSize : DEFAULT_LMS_WORK_LOG_PAGE_SIZE
}
