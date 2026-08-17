import {
  getRomanianLegalHolidayDates,
  getRomanianOrthodoxEaster,
} from "@/lib/lms-work-entries/romanian-holidays"

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

export function toIsoDateFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

export function toIsoDate(date: Date) {
  return toIsoDateFromParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function parseIsoDateToUtcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function parseDotNotationDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return toIsoDate(date)
}

export function excelSerialToIsoDate(serial: number) {
  if (!Number.isFinite(serial)) return null
  const rounded = Math.floor(serial)
  const utcMs = EXCEL_EPOCH_UTC_MS + rounded * 24 * 60 * 60 * 1000
  const date = new Date(utcMs)
  if (Number.isNaN(date.getTime())) return null
  return toIsoDate(date)
}

export function parseDateLikeToIso(value: unknown) {
  if (value == null) return null

  if (typeof value === "number") {
    return excelSerialToIsoDate(value)
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return toIsoDate(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())))
  }

  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
    return parseDotNotationDate(trimmed)
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return toIsoDate(date)
    }
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return toIsoDate(new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())))
}

export function getOrthodoxEasterSundayUtc(year: number) {
  return getRomanianOrthodoxEaster(year)
}

export function getRomanianHolidaysForYear(year: number) {
  return getRomanianLegalHolidayDates(year)
}

export function countWorkingDaysInRange(startIso: string, endIso: string) {
  const start = parseIsoDateToUtcDate(startIso)
  const end = parseIsoDateToUtcDate(endIso)
  if (!start || !end || start > end) return 0

  const holidayCache = new Map<number, Set<string>>()
  const cursor = new Date(start.getTime())
  let count = 0

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay()
    const iso = toIsoDate(cursor)
    const year = cursor.getUTCFullYear()
    const yearHolidays = holidayCache.get(year) ?? getRomanianHolidaysForYear(year)
    holidayCache.set(year, yearHolidays)

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHoliday = yearHolidays.has(iso)
    if (!isWeekend && !isHoliday) count += 1

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return count
}

export function countWorkingDaysInMonth(year: number, monthIndex: number) {
  const monthStart = toIsoDateFromParts(year, monthIndex, 1)
  const monthEndDate = new Date(Date.UTC(year, monthIndex + 1, 0))
  const monthEnd = toIsoDate(monthEndDate)
  return countWorkingDaysInRange(monthStart, monthEnd)
}

export function getMonthKeyFromIso(isoDate: string) {
  return isoDate.slice(0, 7)
}

export function buildMonthKey(year: number, monthIndex: number) {
  return `${year}-${pad2(monthIndex + 1)}`
}

export function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

export function listMonthKeysBetween(startIso: string, endIso: string) {
  const start = parseIsoDateToUtcDate(startIso)
  const end = parseIsoDateToUtcDate(endIso)
  if (!start || !end || start > end) return []

  const keys: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const endMonthStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))

  while (cursor <= endMonthStart) {
    keys.push(buildMonthKey(cursor.getUTCFullYear(), cursor.getUTCMonth()))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return keys
}

export function addDaysToIso(isoDate: string, deltaDays: number) {
  const parsed = parseIsoDateToUtcDate(isoDate)
  if (!parsed) return isoDate
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays)
  return toIsoDate(parsed)
}

export function todayIsoUtc() {
  return toIsoDate(new Date())
}
