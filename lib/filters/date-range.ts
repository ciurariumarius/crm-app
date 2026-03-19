import { isValid, parseISO } from "date-fns"

export const PERIOD_PRESET_VALUES = [
    "all_time",
    "this_month",
    "last_month",
    "this_year",
    "last_year",
    "custom",
] as const

export type PeriodPreset = (typeof PERIOD_PRESET_VALUES)[number]

export type UtcDateRange = {
    gte?: Date
    lt?: Date
    source: "none" | "preset" | "custom"
    effectivePeriod: PeriodPreset
}

function utcDate(year: number, monthIndex: number, day = 1) {
    return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function addUtcDays(date: Date, days: number) {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + days)
    return next
}

export function parseIsoDateParam(value: string | undefined | null) {
    if (!value) return null
    const trimmed = value.trim()
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
    if (ymdMatch) {
        const [, yearRaw, monthRaw, dayRaw] = ymdMatch
        return utcDate(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw))
    }

    const parsed = parseISO(trimmed)
    if (!isValid(parsed)) return null
    return utcDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function normalizePeriodPreset(value: string | undefined | null): PeriodPreset {
    if (!value) return "all_time"
    const normalized = value.trim().toLowerCase()
    if ((PERIOD_PRESET_VALUES as readonly string[]).includes(normalized)) {
        return normalized as PeriodPreset
    }
    return "all_time"
}

export function resolveUtcDateRange(input: {
    period?: string | null
    from?: string | null
    to?: string | null
    now?: Date
}): UtcDateRange {
    const now = input.now ?? new Date()
    const period = normalizePeriodPreset(input.period)
    const from = parseIsoDateParam(input.from)
    const to = parseIsoDateParam(input.to)

    if (from || to) {
        const lower = from && to ? (from <= to ? from : to) : (from || to)
        const upper = from && to ? (from <= to ? to : from) : (from || to)
        return {
            gte: lower ?? undefined,
            lt: upper ? addUtcDays(upper, 1) : undefined,
            source: "custom",
            effectivePeriod: "custom",
        }
    }

    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()

    if (period === "this_month") {
        return {
            gte: utcDate(year, month, 1),
            lt: utcDate(year, month + 1, 1),
            source: "preset",
            effectivePeriod: period,
        }
    }

    if (period === "last_month") {
        return {
            gte: utcDate(year, month - 1, 1),
            lt: utcDate(year, month, 1),
            source: "preset",
            effectivePeriod: period,
        }
    }

    if (period === "this_year") {
        return {
            gte: utcDate(year, 0, 1),
            lt: utcDate(year + 1, 0, 1),
            source: "preset",
            effectivePeriod: period,
        }
    }

    if (period === "last_year") {
        return {
            gte: utcDate(year - 1, 0, 1),
            lt: utcDate(year, 0, 1),
            source: "preset",
            effectivePeriod: period,
        }
    }

    return {
        source: "none",
        effectivePeriod: period,
    }
}
