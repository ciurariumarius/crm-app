import { describe, expect, it } from "vitest"
import {
  buildCrmTaskWorkEntrySourceKey,
  inferTaskScope,
  LmsTaskCompletionSchema,
  TaskScopeSchema,
} from "@/lib/tasks/lms-bridge"

const allocationId = "11111111-1111-4111-8111-111111111111"
const taskTypeId = "22222222-2222-4222-8222-222222222222"

describe("Task LMS bridge contracts", () => {
  it("keeps task scopes explicit and infers legacy task scope safely", () => {
    expect(TaskScopeSchema.parse("GENERAL")).toBe("GENERAL")
    expect(TaskScopeSchema.parse("FREELANCE")).toBe("FREELANCE")
    expect(TaskScopeSchema.parse("LMS")).toBe("LMS")
    expect(inferTaskScope("project-id")).toBe("FREELANCE")
    expect(inferTaskScope(null)).toBe("GENERAL")
  })

  it("accepts a mapped weekday LMS completion", () => {
    expect(LmsTaskCompletionSchema.parse({
      lmsAllocationId: allocationId,
      lmsTaskTypeId: taskTypeId,
      workDate: "2026-08-13",
      durationMinutes: 90,
    })).toEqual({
      lmsAllocationId: allocationId,
      lmsTaskTypeId: taskTypeId,
      workDate: "2026-08-13",
      durationMinutes: 90,
    })
  })

  it("rejects weekend work dates and invalid LMS durations", () => {
    expect(LmsTaskCompletionSchema.safeParse({
      lmsAllocationId: allocationId,
      lmsTaskTypeId: taskTypeId,
      workDate: "2026-08-15",
      durationMinutes: 90,
    }).success).toBe(false)
    expect(LmsTaskCompletionSchema.safeParse({
      lmsAllocationId: allocationId,
      lmsTaskTypeId: taskTypeId,
      workDate: "2026-08-13",
      durationMinutes: 0,
    }).success).toBe(false)
    expect(LmsTaskCompletionSchema.safeParse({
      lmsAllocationId: allocationId,
      lmsTaskTypeId: taskTypeId,
      workDate: "2026-08-13",
      durationMinutes: 1441,
    }).success).toBe(false)
  })

  it("uses a stable source key for retries and audit provenance", () => {
    expect(buildCrmTaskWorkEntrySourceKey("task-id")).toBe("crm-task:task-id")
  })
})
