import {
  countWorkingDaysInRange,
  parseIsoDateToUtcDate,
  toIsoDate,
  toIsoDateFromParts,
} from "@/lib/lms-tasks/date-utils"

const MINUTES_PER_WORKDAY = 8 * 60

export type LmsOwnerPeriodSummary = {
  from: string
  to: string
  loggedMinutes: number
  capacityMinutes: number
  capacityHours: number
  utilizationPercent: number
}

export type LmsOwnerCapacitySummary = {
  employeeName: string
  asOf: string
  latestTaskDate: string | null
  month: LmsOwnerPeriodSummary
  quarter: LmsOwnerPeriodSummary
}

export type LmsOwnerSummaryRanges = {
  month: { from: string; to: string }
  quarter: { from: string; to: string }
}

function parseExactDateOnly(value: string) {
  const parsed = parseIsoDateToUtcDate(value)
  if (!parsed || toIsoDate(parsed) !== value) {
    throw new Error("Expected a valid date in YYYY-MM-DD format")
  }
  return parsed
}

function normalizeLoggedMinutes(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function getLmsOwnerSummaryRanges(asOf: string): LmsOwnerSummaryRanges {
  const date = parseExactDateOnly(asOf)
  const year = date.getUTCFullYear()
  const monthIndex = date.getUTCMonth()
  const quarterStartMonthIndex = Math.floor(monthIndex / 3) * 3
  const quarterEndMonthIndex = quarterStartMonthIndex + 2

  const monthEnd = toIsoDate(new Date(Date.UTC(year, monthIndex + 1, 0)))
  const quarterEnd = toIsoDate(new Date(Date.UTC(year, quarterEndMonthIndex + 1, 0)))

  return {
    month: {
      from: toIsoDateFromParts(year, monthIndex, 1),
      to: monthEnd,
    },
    quarter: {
      from: toIsoDateFromParts(year, quarterStartMonthIndex, 1),
      to: quarterEnd,
    },
  }
}

export function buildLmsOwnerPeriodSummary(input: {
  from: string
  to: string
  loggedMinutes: number
}): LmsOwnerPeriodSummary {
  const loggedMinutes = normalizeLoggedMinutes(input.loggedMinutes)
  const capacityMinutes = countWorkingDaysInRange(input.from, input.to) * MINUTES_PER_WORKDAY

  return {
    from: input.from,
    to: input.to,
    loggedMinutes,
    capacityMinutes,
    capacityHours: capacityMinutes / 60,
    utilizationPercent: capacityMinutes > 0
      ? Number(((loggedMinutes / capacityMinutes) * 100).toFixed(1))
      : 0,
  }
}

export function buildLmsOwnerCapacitySummary(input: {
  employeeName: string
  asOf: string
  latestTaskDate: string | null
  monthLoggedMinutes: number
  quarterLoggedMinutes: number
}): LmsOwnerCapacitySummary {
  const ranges = getLmsOwnerSummaryRanges(input.asOf)

  return {
    employeeName: input.employeeName,
    asOf: input.asOf,
    latestTaskDate: input.latestTaskDate,
    month: buildLmsOwnerPeriodSummary({
      ...ranges.month,
      loggedMinutes: input.monthLoggedMinutes,
    }),
    quarter: buildLmsOwnerPeriodSummary({
      ...ranges.quarter,
      loggedMinutes: input.quarterLoggedMinutes,
    }),
  }
}
