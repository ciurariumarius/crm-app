import { z } from "zod"
import { getRomanianLegalHolidayDates } from "@/lib/lms-work-entries/romanian-holidays"

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ENGLISH_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export function isValidDateOnly(value: string) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export const DateOnlySchema = z
  .string()
  .trim()
  .refine(isValidDateOnly, "Enter a valid date in YYYY-MM-DD format")

export function formatLmsWorkDateLabel(value: string, today: string) {
  const match = DATE_PATTERN.exec(value)
  if (!match || !isValidDateOnly(value)) return value || "Today"
  const formatted = `${match[3]} ${ENGLISH_SHORT_MONTHS[Number(match[2]) - 1]} ${match[1]}`
  return value === today ? `Today · ${formatted}` : formatted
}

export function normalizeDateRange(from?: string | null, to?: string | null) {
  const validatedFrom = from ? DateOnlySchema.parse(from) : null
  const validatedTo = to ? DateOnlySchema.parse(to) : null

  if (validatedFrom && validatedTo && validatedFrom > validatedTo) {
    return { from: validatedTo, to: validatedFrom }
  }

  return { from: validatedFrom, to: validatedTo }
}

export function getLmsWorkCapacity(from?: string | null, to?: string | null) {
  if (!from || !to || !isValidDateOnly(from) || !isValidDateOnly(to)) return null

  const normalized = normalizeDateRange(from, to)
  if (!normalized.from || !normalized.to) return null

  const [startYear, startMonth, startDay] = normalized.from.split("-").map(Number)
  const [endYear, endMonth, endDay] = normalized.to.split("-").map(Number)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)
  const totalDays = Math.floor((end - start) / 86_400_000) + 1
  const fullWeeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7
  const startWeekday = new Date(start).getUTCDay()
  let weekdays = fullWeeks * 5

  for (let offset = 0; offset < remainingDays; offset += 1) {
    const weekday = (startWeekday + offset) % 7
    if (weekday >= 1 && weekday <= 5) weekdays += 1
  }

  let weekdayHolidays = 0
  for (let year = startYear; year <= endYear; year += 1) {
    for (const holiday of getRomanianLegalHolidayDates(year)) {
      if (holiday < normalized.from || holiday > normalized.to) continue
      const [holidayYear, holidayMonth, holidayDay] = holiday.split("-").map(Number)
      const weekday = new Date(Date.UTC(holidayYear, holidayMonth - 1, holidayDay)).getUTCDay()
      if (weekday >= 1 && weekday <= 5) weekdayHolidays += 1
    }
  }

  const workdays = Math.max(0, weekdays - weekdayHolidays)

  return { workdays, hours: workdays * 8, holidays: weekdayHolidays }
}
