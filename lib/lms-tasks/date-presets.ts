export type LmsDatePresetId =
  | "all"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"

export type LmsDatePreset = {
  id: LmsDatePresetId
  label: string
  from: string | null
  to: string | null
}

function isLmsDatePresetId(value: string | null | undefined): value is LmsDatePresetId {
  return (
    value === "all" ||
    value === "this-month" ||
    value === "last-month" ||
    value === "this-quarter" ||
    value === "last-quarter" ||
    value === "this-year" ||
    value === "last-year"
  )
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function isoFromUtcParts(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function fromDateUtc(date: Date) {
  return isoFromUtcParts(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfMonthDayUtc(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function getLmsDatePresets(now: Date = new Date()): LmsDatePreset[] {
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = new Date(year, month, now.getDate())
  const todayIso = fromDateUtc(today)

  const lastMonthYear = month === 0 ? year - 1 : year
  const lastMonthIndex = month === 0 ? 11 : month - 1
  const currentQuarterStart = Math.floor(month / 3) * 3
  const lastQuarterStart = currentQuarterStart === 0 ? 9 : currentQuarterStart - 3
  const lastQuarterYear = currentQuarterStart === 0 ? year - 1 : year

  return [
    { id: "all", label: "All Time", from: null, to: null },
    { id: "this-month", label: "This Month", from: isoFromUtcParts(year, month, 1), to: todayIso },
    {
      id: "last-month",
      label: "Last Month",
      from: isoFromUtcParts(lastMonthYear, lastMonthIndex, 1),
      to: isoFromUtcParts(lastMonthYear, lastMonthIndex, endOfMonthDayUtc(lastMonthYear, lastMonthIndex)),
    },
    { id: "this-quarter", label: "This Quarter", from: isoFromUtcParts(year, currentQuarterStart, 1), to: todayIso },
    {
      id: "last-quarter",
      label: "Last Quarter",
      from: isoFromUtcParts(lastQuarterYear, lastQuarterStart, 1),
      to: isoFromUtcParts(lastQuarterYear, lastQuarterStart + 2, endOfMonthDayUtc(lastQuarterYear, lastQuarterStart + 2)),
    },
    { id: "this-year", label: "This Year", from: isoFromUtcParts(year, 0, 1), to: todayIso },
    { id: "last-year", label: "Last Year", from: isoFromUtcParts(year - 1, 0, 1), to: isoFromUtcParts(year - 1, 11, 31) },
  ]
}

export function resolveLmsDatePreset(presetId: string | null, now: Date = new Date()) {
  const presets = getLmsDatePresets(now)
  return presets.find((preset) => preset.id === presetId) ?? presets[0]
}

export function detectLmsDatePresetId(
  from: string | null,
  to: string | null,
  periodHint?: string | null,
  now: Date = new Date()
) {
  const presets = getLmsDatePresets(now)
  const currentFrom = from ?? ""
  const currentTo = to ?? ""
  const matches = presets.filter((preset) => (preset.from ?? "") === currentFrom && (preset.to ?? "") === currentTo)

  if (matches.length === 0) return "custom"
  if (isLmsDatePresetId(periodHint)) {
    const hinted = matches.find((preset) => preset.id === periodHint)
    if (hinted) return hinted.id
  }

  return matches[0]?.id ?? "custom"
}
