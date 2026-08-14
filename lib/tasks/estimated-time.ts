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

