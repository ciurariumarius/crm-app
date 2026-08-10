"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { buildLmsAllocationSyncKey } from "@/lib/lms-tasks/client-key"
import { LMS_CRM_EMPLOYEE_NAME } from "@/lib/lms-work-entries/crm-template"
import { addDateOnlyDays, DateOnlySchema, getBucharestDateOnly } from "@/lib/lms-work-entries/date"
import { weekdaysToMask } from "@/lib/lms-work-entries/recurrence"
import { canonicalizeLmsWorkTaskName } from "@/lib/lms-work-entries/task-names"
import type {
  LmsWorkEntryInput,
  LmsWorkEntryUpdateInput,
  LmsWorkRecurrenceInput,
} from "@/lib/lms-work-entries/types"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

const EntryIdSchema = z.string().uuid()
const TaskIdSchema = z.string().uuid()
const RecurrenceIdSchema = z.string().uuid()
const TaskOrderSchema = z.array(TaskIdSchema).min(1).max(1000)
const WorkEntryInputSchema = z.object({
  workDate: DateOnlySchema,
  lmsAllocationId: z.string().uuid("Select a valid LMS client"),
  taskTypeId: z.string().uuid("Select a valid task"),
  durationMinutes: z.number().int("Minutes must be a whole number").min(1, "Minutes must be at least 1").max(1440, "Minutes cannot exceed 1440"),
})
const WorkEntryUpdateInputSchema = WorkEntryInputSchema.extend({
  lmsAllocationId: z.string().uuid("Select a valid LMS client").nullable(),
})
const ClientNameSchema = z.string().trim().min(1, "Client name is required").max(255, "Client name is too long")
const TaskNameSchema = z.string().trim().min(1, "Task name is required").max(255, "Task name is too long")
const DefaultDurationMinutesSchema = z.number()
  .int("Default time must be a whole number")
  .min(1, "Default time must be at least 1 minute")
  .max(1440, "Default time cannot exceed 1440 minutes")
  .nullable()
const WorkTaskSettingsSchema = z.object({
  name: TaskNameSchema,
  isActive: z.boolean(),
  defaultDurationMinutes: DefaultDurationMinutesSchema.optional(),
})
const RecurrenceInputSchema = z.object({
  lmsAllocationId: z.string().uuid("Select a valid LMS client"),
  taskTypeId: z.string().uuid("Select a valid task"),
  durationMinutes: z.number().int("Minutes must be a whole number").min(1).max(1440),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Select at least one weekday").max(7),
})

function normalizeTaskName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO")
}

function normalizeClientName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ")
}

function revalidateWorkLog() {
  revalidatePath("/lms-analysis/work-log")
  revalidatePath("/lms-analysis/data")
}

function handleActionError(error: unknown, fallback: string, duplicateMessage = "A task with this name already exists") {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false as const, error: duplicateMessage }
  }
  return { success: false as const, error: getActionErrorMessage(error, fallback) }
}

async function resolveEntryReferences(
  lmsAllocationId: string,
  taskTypeId: string
) {
  const [client, task] = await Promise.all([
    prisma.lmsAllocation.findFirst({
      where: { id: lmsAllocationId },
      select: { id: true, client: true },
    }),
    prisma.lmsWorkTask.findFirst({
      where: { id: taskTypeId, isActive: true },
      select: { id: true, name: true },
    }),
  ])

  if (!client) throw new ActionError("LMS_CLIENT_NOT_FOUND", "Select a client from LMS Projects")
  if (!task) throw new ActionError("TASK_NOT_FOUND", "Select an active predefined task")
  return { client, task }
}

async function assertNoOverlappingRecurrence(args: {
  lmsAllocationId: string
  taskTypeId: string
  durationMinutes: number
  weekdayMask: number
  excludeId?: string
}) {
  const candidates = await prisma.lmsWorkRecurrence.findMany({
    where: {
      lmsAllocationId: args.lmsAllocationId,
      taskTypeId: args.taskTypeId,
      durationMinutes: args.durationMinutes,
      isActive: true,
      ...(args.excludeId ? { id: { not: args.excludeId } } : {}),
    },
    select: { weekdayMask: true },
  })
  if (candidates.some((candidate) => (candidate.weekdayMask & args.weekdayMask) !== 0)) {
    throw new ActionError(
      "LMS_RECURRENCE_OVERLAP",
      "An active rule already uses this client, task, duration, and one or more selected weekdays"
    )
  }
}

export async function createLmsWorkEntry(data: LmsWorkEntryInput) {
  try {
    const session = await requireAuth()
    const validated = WorkEntryInputSchema.parse(data)
    const { client, task } = await resolveEntryReferences(
      validated.lmsAllocationId,
      validated.taskTypeId
    )

    const entry = await prisma.lmsWorkEntry.create({
      data: {
        lmsAllocationId: client.id,
        taskTypeId: task.id,
        workDate: validated.workDate,
        durationMinutes: validated.durationMinutes,
        clientDomainSnapshot: client.client,
        taskNameSnapshot: task.name,
        employeeNameSnapshot: LMS_CRM_EMPLOYEE_NAME,
      },
      select: { id: true },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRY_CREATED",
      details: `entryId=${entry.id}; lmsAllocationId=${client.id}; workDate=${validated.workDate}`,
    })
    revalidateWorkLog()
    return { success: true as const, id: entry.id }
  } catch (error) {
    return handleActionError(error, "Failed to save work entry")
  }
}

export async function updateLmsWorkEntry(entryId: string, data: LmsWorkEntryUpdateInput) {
  try {
    const session = await requireAuth()
    const validatedId = EntryIdSchema.parse(entryId)
    const validated = WorkEntryUpdateInputSchema.parse(data)
    const existing = await prisma.lmsWorkEntry.findFirst({
      where: { id: validatedId },
      select: { id: true, lmsAllocationId: true, taskTypeId: true },
    })
    if (!existing) throw new ActionError("ENTRY_NOT_FOUND", "Work entry not found")

    if (validated.lmsAllocationId === null && existing.lmsAllocationId !== null) {
      throw new ActionError("LMS_CLIENT_REQUIRED", "Select a client from LMS Projects")
    }

    const clientChanged = validated.lmsAllocationId !== existing.lmsAllocationId
    const taskChanged = validated.taskTypeId !== existing.taskTypeId
    const [nextClient, nextTask] = await Promise.all([
      clientChanged && validated.lmsAllocationId
        ? prisma.lmsAllocation.findFirst({
            where: { id: validated.lmsAllocationId },
            select: { id: true, client: true },
          })
        : null,
      taskChanged
        ? prisma.lmsWorkTask.findFirst({
            where: { id: validated.taskTypeId, isActive: true },
            select: { id: true, name: true },
          })
        : null,
    ])
    if (clientChanged && !nextClient) {
      throw new ActionError("LMS_CLIENT_NOT_FOUND", "Select a client from LMS Projects")
    }
    if (taskChanged && !nextTask) {
      throw new ActionError("TASK_NOT_FOUND", "Select an active predefined task")
    }

    await prisma.lmsWorkEntry.update({
      where: { id: existing.id },
      data: {
        workDate: validated.workDate,
        durationMinutes: validated.durationMinutes,
        exportedAt: null,
        ...(nextClient
          ? {
              lmsAllocationId: nextClient.id,
              clientDomainSnapshot: nextClient.client,
            }
          : {}),
        ...(nextTask
          ? {
              taskTypeId: nextTask.id,
              taskNameSnapshot: nextTask.name,
            }
          : {}),
      },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRY_UPDATED",
      details: `entryId=${existing.id}; lmsAllocationId=${validated.lmsAllocationId || "detached"}; workDate=${validated.workDate}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to update work entry")
  }
}

export async function deleteLmsWorkEntry(entryId: string) {
  try {
    const session = await requireAuth()
    const validatedId = EntryIdSchema.parse(entryId)
    const existing = await prisma.lmsWorkEntry.findFirst({
      where: { id: validatedId },
      select: { id: true },
    })
    if (!existing) throw new ActionError("ENTRY_NOT_FOUND", "Work entry not found")

    await prisma.lmsWorkEntry.delete({ where: { id: existing.id } })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRY_DELETED",
      details: `entryId=${existing.id}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to delete work entry")
  }
}

export async function createLmsWorkClient(name: string) {
  try {
    const session = await requireAuth()
    const clientName = normalizeClientName(ClientNameSchema.parse(name))
    const syncKey = buildLmsAllocationSyncKey(clientName)
    if (!syncKey) {
      throw new ActionError("INVALID_LMS_CLIENT", "Enter a client name with letters or numbers")
    }
    const existing = await prisma.lmsAllocation.findUnique({
      where: { syncKey },
      select: { id: true, client: true },
    })
    if (existing) {
      return { success: true as const, client: existing, existed: true as const }
    }

    let client: { id: string; client: string }
    try {
      client = await prisma.lmsAllocation.create({
        data: {
          syncKey,
          client: clientName,
          specialist: LMS_CRM_EMPLOYEE_NAME,
        },
        select: { id: true, client: true },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error
      }
      const concurrentlyCreated = await prisma.lmsAllocation.findUnique({
        where: { syncKey },
        select: { id: true, client: true },
      })
      if (!concurrentlyCreated) throw error
      return { success: true as const, client: concurrentlyCreated, existed: true as const }
    }
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_CLIENT_CREATED",
      details: `lmsAllocationId=${client.id}`,
    })
    revalidateWorkLog()
    revalidatePath("/lms-analysis/projects")
    return { success: true as const, client, existed: false as const }
  } catch (error) {
    return handleActionError(error, "Failed to add client", "A client with this name already exists")
  }
}

export async function createLmsWorkTask(data: string | {
  name: string
  defaultDurationMinutes?: number | null
}) {
  try {
    const session = await requireAuth()
    const validated = z.object({
      name: TaskNameSchema,
      defaultDurationMinutes: DefaultDurationMinutesSchema.optional().default(null),
    }).parse(typeof data === "string" ? { name: data } : data)
    const validatedName = canonicalizeLmsWorkTaskName(validated.name)
    const task = await prisma.$transaction(async (tx) => {
      const aggregate = await tx.lmsWorkTask.aggregate({
        _max: { sortOrder: true },
      })
      return tx.lmsWorkTask.create({
        data: {
          name: validatedName,
          normalizedName: normalizeTaskName(validatedName),
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          defaultDurationMinutes: validated.defaultDurationMinutes,
        },
        select: { id: true },
      })
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_TASK_CREATED",
      details: `taskId=${task.id}; defaultDurationMinutes=${validated.defaultDurationMinutes ?? "none"}`,
    })
    revalidateWorkLog()
    return { success: true as const, id: task.id }
  } catch (error) {
    return handleActionError(error, "Failed to add task")
  }
}

export async function reorderLmsWorkTasks(taskIds: string[]) {
  try {
    const session = await requireAuth()
    const orderedIds = TaskOrderSchema.parse(taskIds)
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ActionError("INVALID_TASK_ORDER", "Task order contains duplicates")
    }

    const existing = await prisma.lmsWorkTask.findMany({
      select: { id: true },
    })
    const existingIds = new Set(existing.map((task) => task.id))
    if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id))) {
      throw new ActionError("INVALID_TASK_ORDER", "Refresh the catalog before reordering tasks")
    }

    await prisma.$transaction(
      orderedIds.map((id, sortOrder) => prisma.lmsWorkTask.updateMany({
        where: { id },
        data: { sortOrder },
      }))
    )
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_TASKS_REORDERED",
      details: `taskCount=${orderedIds.length}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to reorder tasks")
  }
}

export async function updateLmsWorkTask(
  taskId: string,
  data: { name: string; isActive: boolean; defaultDurationMinutes?: number | null }
) {
  try {
    const session = await requireAuth()
    const validatedId = TaskIdSchema.parse(taskId)
    const validated = WorkTaskSettingsSchema.parse(data)
    const name = canonicalizeLmsWorkTaskName(validated.name)
    const existing = await prisma.lmsWorkTask.findFirst({
      where: { id: validatedId },
      select: { id: true, defaultDurationMinutes: true },
    })
    if (!existing) throw new ActionError("TASK_NOT_FOUND", "Predefined task not found")
    const defaultDurationMinutes = validated.defaultDurationMinutes === undefined
      ? existing.defaultDurationMinutes
      : validated.defaultDurationMinutes

    await prisma.lmsWorkTask.update({
      where: { id: existing.id },
      data: {
        name,
        normalizedName: normalizeTaskName(name),
        isActive: validated.isActive,
        defaultDurationMinutes,
      },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_TASK_UPDATED",
      details: `taskId=${existing.id}; active=${validated.isActive}; defaultDurationMinutes=${defaultDurationMinutes ?? "none"}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to update task")
  }
}

export async function createLmsWorkRecurrence(data: LmsWorkRecurrenceInput) {
  try {
    const session = await requireAuth()
    const validated = RecurrenceInputSchema.parse(data)
    const weekdays = [...new Set(validated.weekdays)]
    const weekdayMask = weekdaysToMask(weekdays)
    const { client, task } = await resolveEntryReferences(
      validated.lmsAllocationId,
      validated.taskTypeId
    )
    await assertNoOverlappingRecurrence({
      lmsAllocationId: client.id,
      taskTypeId: task.id,
      durationMinutes: validated.durationMinutes,
      weekdayMask,
    })

    const recurrence = await prisma.lmsWorkRecurrence.create({
      data: {
        lmsAllocationId: client.id,
        taskTypeId: task.id,
        clientSnapshot: client.client,
        taskSnapshot: task.name,
        durationMinutes: validated.durationMinutes,
        weekdayMask,
        startsOn: getBucharestDateOnly(),
      },
      select: { id: true },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_RECURRENCE_CREATED",
      details: `recurrenceId=${recurrence.id}; clientId=${client.id}; taskId=${task.id}; weekdays=${weekdays.join(",")}`,
    })
    revalidateWorkLog()
    return { success: true as const, id: recurrence.id }
  } catch (error) {
    return handleActionError(error, "Failed to create recurring work rule")
  }
}

export async function updateLmsWorkRecurrence(
  recurrenceId: string,
  data: LmsWorkRecurrenceInput
) {
  try {
    const session = await requireAuth()
    const validatedId = RecurrenceIdSchema.parse(recurrenceId)
    const validated = RecurrenceInputSchema.parse(data)
    const weekdays = [...new Set(validated.weekdays)]
    const weekdayMask = weekdaysToMask(weekdays)
    const existing = await prisma.lmsWorkRecurrence.findFirst({
      where: { id: validatedId },
      select: { id: true, isActive: true },
    })
    if (!existing) throw new ActionError("LMS_RECURRENCE_NOT_FOUND", "Recurring work rule not found")
    const { client, task } = await resolveEntryReferences(
      validated.lmsAllocationId,
      validated.taskTypeId
    )
    if (existing.isActive) {
      await assertNoOverlappingRecurrence({
        lmsAllocationId: client.id,
        taskTypeId: task.id,
        durationMinutes: validated.durationMinutes,
        weekdayMask,
        excludeId: existing.id,
      })
    }

    await prisma.lmsWorkRecurrence.update({
      where: { id: existing.id },
      data: {
        lmsAllocationId: client.id,
        taskTypeId: task.id,
        clientSnapshot: client.client,
        taskSnapshot: task.name,
        durationMinutes: validated.durationMinutes,
        weekdayMask,
      },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_RECURRENCE_UPDATED",
      details: `recurrenceId=${existing.id}; clientId=${client.id}; taskId=${task.id}; weekdays=${weekdays.join(",")}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to update recurring work rule")
  }
}

export async function setLmsWorkRecurrenceActive(recurrenceId: string, isActive: boolean) {
  try {
    const session = await requireAuth()
    const validatedId = RecurrenceIdSchema.parse(recurrenceId)
    const validatedActive = z.boolean().parse(isActive)
    const existing = await prisma.lmsWorkRecurrence.findFirst({
      where: { id: validatedId },
      select: {
        id: true,
        isActive: true,
        lmsAllocationId: true,
        taskTypeId: true,
        durationMinutes: true,
        weekdayMask: true,
        taskType: { select: { isActive: true } },
      },
    })
    if (!existing) throw new ActionError("LMS_RECURRENCE_NOT_FOUND", "Recurring work rule not found")
    if (existing.isActive === validatedActive) return { success: true as const }

    if (validatedActive) {
      if (!existing.lmsAllocationId) {
        throw new ActionError("LMS_CLIENT_NOT_FOUND", "Choose an available LMS client before activating this rule")
      }
      if (!existing.taskType.isActive) {
        throw new ActionError("TASK_NOT_FOUND", "Choose an active predefined task before activating this rule")
      }
      await assertNoOverlappingRecurrence({
        lmsAllocationId: existing.lmsAllocationId,
        taskTypeId: existing.taskTypeId,
        durationMinutes: existing.durationMinutes,
        weekdayMask: existing.weekdayMask,
        excludeId: existing.id,
      })
    }

    const today = getBucharestDateOnly()
    await prisma.lmsWorkRecurrence.update({
      where: { id: existing.id },
      data: validatedActive
        ? { isActive: true, startsOn: today, processedThrough: addDateOnlyDays(today, -1) }
        : { isActive: false },
    })
    await logSessionAuditEvent(session, {
      action: validatedActive ? "LMS_WORK_RECURRENCE_ACTIVATED" : "LMS_WORK_RECURRENCE_DEACTIVATED",
      details: `recurrenceId=${existing.id}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to change recurring work rule status")
  }
}
