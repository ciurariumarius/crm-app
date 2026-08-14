import { z } from "zod"
import { DateOnlySchema, isLmsWorkWeekday } from "@/lib/lms-work-entries/date"

export const TASK_SCOPES = ["GENERAL", "FREELANCE", "LMS"] as const
export const LMS_WORK_ENTRY_ORIGINS = ["MANUAL", "RECURRENCE", "CRM_TASK"] as const

export type TaskScope = (typeof TASK_SCOPES)[number]
export type LmsWorkEntryOrigin = (typeof LMS_WORK_ENTRY_ORIGINS)[number]

export type TaskTargetInput =
  | {
      taskScope: "GENERAL"
      projectId: null
      lmsAllocationId: null
      lmsTaskTypeId: null
    }
  | {
      taskScope: "FREELANCE"
      projectId: string
      lmsAllocationId: null
      lmsTaskTypeId: null
    }
  | {
      taskScope: "LMS"
      projectId: null
      lmsAllocationId: string | null
      lmsTaskTypeId: string | null
    }

export const TaskScopeSchema = z.enum(TASK_SCOPES)

export const LmsTaskCompletionSchema = z.object({
  lmsAllocationId: z.string().uuid("Select a valid LMS project"),
  lmsTaskTypeId: z.string().uuid("Select a valid LMS task type"),
  workDate: DateOnlySchema.refine(
    isLmsWorkWeekday,
    "LMS work entries can only be recorded Monday-Friday"
  ),
  durationMinutes: z
    .number()
    .int("Minutes must be a whole number")
    .min(1, "Minutes must be at least 1")
    .max(1440, "Minutes cannot exceed 1440"),
}).strict()

export type LmsTaskCompletionInput = z.infer<typeof LmsTaskCompletionSchema>

export function buildCrmTaskWorkEntrySourceKey(taskId: string) {
  return `crm-task:${taskId}`
}

export function inferTaskScope(projectId: string | null | undefined): TaskScope {
  return projectId ? "FREELANCE" : "GENERAL"
}

export function buildTaskTargetInput(input: {
  taskScope: TaskScope
  projectId?: string | null
  lmsAllocationId?: string | null
  lmsTaskTypeId?: string | null
}): TaskTargetInput {
  if (input.taskScope === "FREELANCE") {
    if (!input.projectId) {
      throw new Error("A freelance task target requires a CRM project")
    }
    return {
      taskScope: "FREELANCE",
      projectId: input.projectId,
      lmsAllocationId: null,
      lmsTaskTypeId: null,
    }
  }

  if (input.taskScope === "LMS") {
    return {
      taskScope: "LMS",
      projectId: null,
      lmsAllocationId: input.lmsAllocationId ?? null,
      lmsTaskTypeId: input.lmsTaskTypeId ?? null,
    }
  }

  return {
    taskScope: "GENERAL",
    projectId: null,
    lmsAllocationId: null,
    lmsTaskTypeId: null,
  }
}
