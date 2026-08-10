export type LmsWorkOptionFrequency = {
  id: string | null
  count: number
}

export function rankLmsWorkOptionsByFrequency<T extends { id: string }>(
  options: T[],
  frequencies: LmsWorkOptionFrequency[],
  getLabel: (option: T) => string,
  limit = 6
) {
  const usage = new Map(
    frequencies
      .filter((frequency): frequency is { id: string; count: number } => (
        Boolean(frequency.id) && Number.isInteger(frequency.count) && frequency.count > 0
      ))
      .map((frequency) => [frequency.id, frequency.count])
  )

  return options
    .filter((option) => usage.has(option.id))
    .sort((left, right) => (
      (usage.get(right.id) ?? 0) - (usage.get(left.id) ?? 0)
      || getLabel(left).localeCompare(getLabel(right), "ro")
    ))
    .slice(0, Math.max(0, Math.trunc(limit)))
}

export function mergeLmsWorkOptionShortcuts<T extends { id: string }>(
  primary: T[],
  fallback: T[],
  limit = 6
) {
  const options = new Map<string, T>()
  for (const option of [...primary, ...fallback]) {
    if (!options.has(option.id)) options.set(option.id, option)
  }
  return Array.from(options.values()).slice(0, Math.max(0, Math.trunc(limit)))
}
