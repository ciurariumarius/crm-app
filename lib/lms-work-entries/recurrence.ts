export const LMS_RECURRENCE_WEEKDAYS = [
  { value: 1, shortLabel: "Mon", label: "Monday" },
  { value: 2, shortLabel: "Tue", label: "Tuesday" },
  { value: 3, shortLabel: "Wed", label: "Wednesday" },
  { value: 4, shortLabel: "Thu", label: "Thursday" },
  { value: 5, shortLabel: "Fri", label: "Friday" },
  { value: 6, shortLabel: "Sat", label: "Saturday" },
  { value: 7, shortLabel: "Sun", label: "Sunday" },
] as const

export const LMS_RECURRENCE_WORKDAYS = [1, 2, 3, 4, 5] as const

export function weekdaysToMask(weekdays: number[]) {
  return weekdays.reduce((mask, weekday) => mask | (1 << (weekday - 1)), 0)
}

export function maskToWeekdays(mask: number) {
  return LMS_RECURRENCE_WEEKDAYS
    .filter(({ value }) => (mask & (1 << (value - 1))) !== 0)
    .map(({ value }) => value)
}

export function getDateOnlyWeekday(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return sundayFirst === 0 ? 7 : sundayFirst
}

export function recurrenceRunsOnDate(weekdayMask: number, value: string) {
  return (weekdayMask & (1 << (getDateOnlyWeekday(value) - 1))) !== 0
}

export function formatRecurrenceSchedule(weekdays: number[]) {
  const normalized = [...new Set(weekdays)].sort((left, right) => left - right)
  if (normalized.join(",") === "1,2,3,4,5") return "Monday–Friday"
  if (normalized.join(",") === "6,7") return "Weekend"
  return LMS_RECURRENCE_WEEKDAYS
    .filter(({ value }) => normalized.includes(value))
    .map(({ shortLabel }) => shortLabel)
    .join(", ")
}
