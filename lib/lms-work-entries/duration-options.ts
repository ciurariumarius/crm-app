export const LMS_WORK_DURATION_PRESETS = [10, 15, 30, 45, 60, 120, 150, 180, 240, 300, 360] as const

export const DEFAULT_LMS_WORK_DURATION_MINUTES = 120
export const LMS_WORK_DURATION_FALLBACK_SHORTCUTS = [30, 60, 120, 180, 240, 360] as const
export const LMS_WORK_DURATION_SHORTCUT_LIMIT = 6

export type LmsWorkDurationPreset = (typeof LMS_WORK_DURATION_PRESETS)[number]

export type LmsWorkDurationFrequency = {
  durationMinutes: number
  count: number
}

export function isValidLmsWorkDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1440
}

export function isLmsWorkDurationPreset(value: unknown): value is LmsWorkDurationPreset {
  return isValidLmsWorkDuration(value) && LMS_WORK_DURATION_PRESETS.some((preset) => preset === value)
}

export function parseCustomLmsWorkDuration(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return isValidLmsWorkDuration(parsed) ? parsed : null
}

export function buildLmsWorkDurationShortcuts(frequencies: LmsWorkDurationFrequency[]) {
  const ranked = frequencies
    .filter(({ durationMinutes, count }) => isValidLmsWorkDuration(durationMinutes) && Number.isInteger(count) && count > 0)
    .sort((left, right) => right.count - left.count || left.durationMinutes - right.durationMinutes)
    .map(({ durationMinutes }) => durationMinutes)

  return Array.from(new Set([...ranked, ...LMS_WORK_DURATION_FALLBACK_SHORTCUTS]))
    .slice(0, LMS_WORK_DURATION_SHORTCUT_LIMIT)
}
