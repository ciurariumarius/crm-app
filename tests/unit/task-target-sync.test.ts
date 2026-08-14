import { describe, expect, it } from "vitest"
import {
  shouldApplyIncomingTaskTarget,
  type TaskTargetSnapshot,
} from "@/components/tasks/task-target-sync"

const emptyLmsTarget: TaskTargetSnapshot = {
  taskScope: "LMS",
  projectId: "",
  lmsAllocationId: "",
  lmsTaskTypeId: "",
}

const mappedLmsTarget: TaskTargetSnapshot = {
  ...emptyLmsTarget,
  lmsAllocationId: "allocation-a",
  lmsTaskTypeId: "category-b",
}

describe("task target prop synchronization", () => {
  it("does not let a stale same-task row replace unsaved target edits", () => {
    expect(shouldApplyIncomingTaskTarget({
      taskChanged: false,
      hasUnsavedTarget: true,
      awaitingSavedTarget: false,
      incomingTarget: emptyLmsTarget,
      savedTarget: emptyLmsTarget,
    })).toBe(false)
  })

  it("keeps the saved snapshot until router refresh returns the matching target", () => {
    expect(shouldApplyIncomingTaskTarget({
      taskChanged: false,
      hasUnsavedTarget: false,
      awaitingSavedTarget: true,
      incomingTarget: emptyLmsTarget,
      savedTarget: mappedLmsTarget,
    })).toBe(false)

    expect(shouldApplyIncomingTaskTarget({
      taskChanged: false,
      hasUnsavedTarget: false,
      awaitingSavedTarget: true,
      incomingTarget: mappedLmsTarget,
      savedTarget: mappedLmsTarget,
    })).toBe(true)
  })

  it("always initializes a newly selected task", () => {
    expect(shouldApplyIncomingTaskTarget({
      taskChanged: true,
      hasUnsavedTarget: true,
      awaitingSavedTarget: true,
      incomingTarget: emptyLmsTarget,
      savedTarget: mappedLmsTarget,
    })).toBe(true)
  })
})
