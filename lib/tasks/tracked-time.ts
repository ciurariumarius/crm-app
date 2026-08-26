export const MAX_TASK_TRACKED_MINUTES = 525_600

export type TaskTimeLogForTotal = {
  id: string
  durationSeconds: number | null
}

export type TaskTimeTotalPlan = {
  createSeconds: number
  updates: Array<{ id: string; durationSeconds: number }>
  deleteIds: string[]
}

export function parseTaskTrackedMinutesInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!/^\d+$/.test(trimmed)) return undefined

  const minutes = Number(trimmed)
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_TASK_TRACKED_MINUTES) {
    return undefined
  }
  return minutes
}

export function parseFlexibleMinutes(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return undefined

  if (/^\d+$/.test(trimmed)) {
    const minutes = Number(trimmed)
    return Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= MAX_TASK_TRACKED_MINUTES
      ? minutes
      : undefined
  }

  const decimalHoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/)
  if (decimalHoursMatch) {
    const hours = parseFloat(decimalHoursMatch[1])
    if (!Number.isNaN(hours) && hours >= 0) {
      const minutes = Math.round(hours * 60)
      return minutes <= MAX_TASK_TRACKED_MINUTES ? minutes : undefined
    }
  }

  let totalMinutes = 0
  let matched = false

  const hoursMatch = trimmed.match(/(\d+)\s*h(?:ours?)?/)
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60
    matched = true
  }

  const minutesMatch = trimmed.match(/(\d+)\s*m(?:in(?:ute)?s?)?/)
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10)
    matched = true
  }

  if (hoursMatch && !minutesMatch) {
    const afterHours = trimmed.substring(trimmed.indexOf("h") + 1).trim()
    if (/^\d+$/.test(afterHours)) {
      totalMinutes += parseInt(afterHours, 10)
      matched = true
    }
  }

  if (matched && totalMinutes >= 0 && totalMinutes <= MAX_TASK_TRACKED_MINUTES) {
    return totalMinutes
  }

  return undefined
}

export function formatTaskTrackedSeconds(totalSeconds: number) {
  const normalizedSeconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(normalizedSeconds / 3600)
  const minutes = Math.floor((normalizedSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return "0m"
}

export function buildTaskTimeTotalPlan(
  newestFirstLogs: TaskTimeLogForTotal[],
  targetSeconds: number
): TaskTimeTotalPlan {
  const normalizedTarget = Math.max(0, Math.round(targetSeconds))
  const currentSeconds = newestFirstLogs.reduce(
    (total, log) => total + Math.max(0, log.durationSeconds || 0),
    0
  )

  if (normalizedTarget >= currentSeconds) {
    return {
      createSeconds: normalizedTarget - currentSeconds,
      updates: [],
      deleteIds: [],
    }
  }

  let secondsToRemove = currentSeconds - normalizedTarget
  const updates: TaskTimeTotalPlan["updates"] = []
  const deleteIds: string[] = []

  for (const log of newestFirstLogs) {
    if (secondsToRemove <= 0) break
    const durationSeconds = Math.max(0, log.durationSeconds || 0)
    if (durationSeconds <= secondsToRemove) {
      deleteIds.push(log.id)
      secondsToRemove -= durationSeconds
      continue
    }

    updates.push({ id: log.id, durationSeconds: durationSeconds - secondsToRemove })
    secondsToRemove = 0
  }

  return { createSeconds: 0, updates, deleteIds }
}
