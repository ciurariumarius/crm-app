export const LMS_WORK_DURATION_PRESETS = [15, 30, 45, 60, 120, 150, 180, 240, 300, 360] as const

export const LMS_WORK_DURATION_STORAGE_KEY = "lms-work-log:last-duration:v1"

export type LmsWorkDurationPreset = (typeof LMS_WORK_DURATION_PRESETS)[number]

export type LmsWorkDurationPreference =
  | { mode: "preset"; minutes: LmsWorkDurationPreset }
  | { mode: "custom"; minutes: number }

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

export function parseLmsWorkDurationPreference(value: string | null): LmsWorkDurationPreference | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { version?: unknown; mode?: unknown; minutes?: unknown }
    if (parsed.version !== 1) return null
    if (parsed.mode === "preset" && isLmsWorkDurationPreset(parsed.minutes)) {
      return { mode: "preset", minutes: parsed.minutes }
    }
    if (parsed.mode === "custom" && isValidLmsWorkDuration(parsed.minutes)) {
      return { mode: "custom", minutes: parsed.minutes }
    }
    return null
  } catch {
    return null
  }
}

export function serializeLmsWorkDurationPreference(preference: LmsWorkDurationPreference) {
  return JSON.stringify({ version: 1, ...preference })
}
