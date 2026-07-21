import { z } from "zod"

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
