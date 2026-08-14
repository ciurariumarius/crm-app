import { describe, expect, it } from "vitest"
import { resolveCompletionDefaultMinutes } from "@/components/tasks/task-completion-defaults"

describe("LMS task completion duration defaults", () => {
  const taskTypes = [
    { id: "category-a", defaultDurationMinutes: 30 },
    { id: "category-b", defaultDurationMinutes: 90 },
  ]

  it("uses the selected option when a stale relation belongs to a different category", () => {
    expect(resolveCompletionDefaultMinutes({
      estimatedMinutes: null,
      lmsTaskTypeId: "category-b",
      lmsTaskType: { id: "category-a", defaultDurationMinutes: 30 },
    }, taskTypes)).toEqual({ minutes: 90, source: "category" })
  })

  it("still prioritizes a valid estimate over category defaults", () => {
    expect(resolveCompletionDefaultMinutes({
      estimatedMinutes: 45,
      lmsTaskTypeId: "category-b",
      lmsTaskType: { id: "category-a", defaultDurationMinutes: 30 },
    }, taskTypes)).toEqual({ minutes: 45, source: "estimate" })
  })

  it("ignores invalid estimates and invalid category defaults", () => {
    expect(resolveCompletionDefaultMinutes({
      estimatedMinutes: 1441,
      lmsTaskTypeId: "category-b",
      lmsTaskType: { id: "category-b", defaultDurationMinutes: 0 },
    }, [{ id: "category-b", defaultDurationMinutes: 0 }])).toEqual({ minutes: null, source: "empty" })
  })
})
