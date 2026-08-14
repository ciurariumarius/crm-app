import type { TaskScopeValue } from "@/components/tasks/task-target-fields"

export type TaskTargetSnapshot = {
  taskScope: TaskScopeValue
  projectId: string
  lmsAllocationId: string
  lmsTaskTypeId: string
}

export function taskTargetsEqual(left: TaskTargetSnapshot, right: TaskTargetSnapshot) {
  return left.taskScope === right.taskScope
    && left.projectId === right.projectId
    && left.lmsAllocationId === right.lmsAllocationId
    && left.lmsTaskTypeId === right.lmsTaskTypeId
}

export function shouldApplyIncomingTaskTarget({
  taskChanged,
  hasUnsavedTarget,
  awaitingSavedTarget,
  incomingTarget,
  savedTarget,
}: {
  taskChanged: boolean
  hasUnsavedTarget: boolean
  awaitingSavedTarget: boolean
  incomingTarget: TaskTargetSnapshot
  savedTarget: TaskTargetSnapshot
}) {
  if (taskChanged) return true
  if (hasUnsavedTarget) return false
  if (awaitingSavedTarget && !taskTargetsEqual(incomingTarget, savedTarget)) return false
  return true
}
