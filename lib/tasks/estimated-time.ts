export const MAX_TASK_ESTIMATED_MINUTES = 100000

export function parseTaskEstimatedMinutesInput(value: string): number | null | undefined {
  const normalized = value.trim()
  if (!normalized) return null
  if (!/^\d+$/.test(normalized)) return undefined

  const minutes = Number(normalized)
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_TASK_ESTIMATED_MINUTES) {
    return undefined
  }

  return minutes
}

export function formatTaskEstimatedMinutes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return null

  const minutes = Math.round(value)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes}m`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}
