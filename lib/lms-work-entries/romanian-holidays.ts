const DAY_IN_MILLISECONDS = 86_400_000

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function formatUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MILLISECONDS)
}

/**
 * Orthodox Easter in the Gregorian calendar, calculated from the Julian
 * computus used by the Romanian Orthodox Church.
 */
export function getRomanianOrthodoxEaster(year: number) {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const julianMonth = Math.floor((d + e + 114) / 31)
  const julianDay = ((d + e + 114) % 31) + 1
  const calendarOffset = Math.floor(year / 100) - Math.floor(year / 400) - 2

  return new Date(Date.UTC(year, julianMonth - 1, julianDay + calendarOffset))
}

/** Romanian nationwide non-working holidays from Labor Code article 139. */
export function getRomanianLegalHolidayDates(year: number) {
  const easter = getRomanianOrthodoxEaster(year)
  const holidays = new Set([
    `${year}-01-01`,
    `${year}-01-02`,
    `${year}-01-06`,
    `${year}-01-07`,
    `${year}-01-24`,
    `${year}-05-01`,
    `${year}-06-01`,
    `${year}-08-15`,
    `${year}-11-30`,
    `${year}-12-01`,
    `${year}-12-25`,
    `${year}-12-26`,
    formatUtcDate(addUtcDays(easter, -2)),
    formatUtcDate(easter),
    formatUtcDate(addUtcDays(easter, 1)),
    formatUtcDate(addUtcDays(easter, 49)),
    formatUtcDate(addUtcDays(easter, 50)),
  ])

  return holidays
}

