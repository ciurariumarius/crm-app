const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/

export type ParsedMonthKey = {
    year: number
    month: number
}

export function parseMonthKey(value: string): ParsedMonthKey | null {
    const match = MONTH_KEY_PATTERN.exec(value)
    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2])
    if (!Number.isInteger(year) || month < 1 || month > 12) return null
    return { year, month }
}

export function buildMonthKey(year: number, month: number) {
    return `${year}-${String(month).padStart(2, "0")}`
}

export function getMonthKeyFromDate(value: Date | string) {
    const parsed = value instanceof Date ? new Date(value) : new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new Error("Expected a valid date")
    return buildMonthKey(parsed.getFullYear(), parsed.getMonth() + 1)
}

export function getMinimumRecurringMonth(sourceCreatedAt: Date | string) {
    const source = parseMonthKey(getMonthKeyFromDate(sourceCreatedAt))
    if (!source) throw new Error("Expected a valid source project month")

    const nextMonthIndex = source.month
    const year = source.year + Math.floor(nextMonthIndex / 12)
    const month = (nextMonthIndex % 12) + 1
    return buildMonthKey(year, month)
}

export function getDefaultRecurringMonth(
    sourceCreatedAt: Date | string,
    now: Date = new Date()
) {
    const minimumMonth = getMinimumRecurringMonth(sourceCreatedAt)
    const currentMonth = getMonthKeyFromDate(now)
    return currentMonth >= minimumMonth ? currentMonth : minimumMonth
}

export function formatMonthKeyLabel(value: string, style: "long" | "short" = "long") {
    const parsed = parseMonthKey(value)
    if (!parsed) return value

    return new Intl.DateTimeFormat("en-GB", {
        month: style,
        year: style === "long" ? "numeric" : undefined,
    }).format(new Date(parsed.year, parsed.month - 1, 1, 12))
}
