import { z } from "zod"

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

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

export function normalizeDateRange(from?: string | null, to?: string | null) {
  const validatedFrom = from ? DateOnlySchema.parse(from) : null
  const validatedTo = to ? DateOnlySchema.parse(to) : null

  if (validatedFrom && validatedTo && validatedFrom > validatedTo) {
    return { from: validatedTo, to: validatedFrom }
  }

  return { from: validatedFrom, to: validatedTo }
}

