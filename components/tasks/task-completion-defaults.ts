export type CompletionDefaultTask = {
  estimatedMinutes?: number | null
  lmsTaskTypeId?: string | null
  lmsTaskType?: {
    id?: string | null
    defaultDurationMinutes?: number | null
  } | null
}

export type CompletionDefaultTaskType = {
  id: string
  defaultDurationMinutes: number | null
}

export function validCompletionMinutes(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 1440 ? Number(value) : null
}

export function resolveCompletionDefaultMinutes(
  task: CompletionDefaultTask,
  options: CompletionDefaultTaskType[] = []
) {
  const estimatedMinutes = validCompletionMinutes(task.estimatedMinutes)
  if (estimatedMinutes !== null) {
    return { minutes: estimatedMinutes, source: "estimate" as const }
  }

  const selectedTaskTypeId = task.lmsTaskTypeId || task.lmsTaskType?.id || ""
  if (!selectedTaskTypeId) return { minutes: null, source: "empty" as const }

  // Relation data belongs to the selected category only when both IDs match.
  // A freshly changed mapping can retain the previous relation until refresh.
  const relationMinutes = task.lmsTaskType?.id === selectedTaskTypeId
    ? validCompletionMinutes(task.lmsTaskType.defaultDurationMinutes)
    : null
  if (relationMinutes !== null) {
    return { minutes: relationMinutes, source: "category" as const }
  }

  const optionMinutes = validCompletionMinutes(
    options.find((option) => option.id === selectedTaskTypeId)?.defaultDurationMinutes
  )
  return optionMinutes === null
    ? { minutes: null, source: "empty" as const }
    : { minutes: optionMinutes, source: "category" as const }
}
