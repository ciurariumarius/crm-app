"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { LMS_CRM_EMPLOYEE_NAME } from "@/lib/lms-work-entries/crm-template"
import { DateOnlySchema } from "@/lib/lms-work-entries/date"
import { canonicalizeLmsWorkTaskName } from "@/lib/lms-work-entries/task-names"
import type { LmsWorkEntryInput, LmsWorkEntryUpdateInput } from "@/lib/lms-work-entries/types"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"

const EntryIdSchema = z.string().uuid()
const TaskIdSchema = z.string().uuid()
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
const TaskNameSchema = z.string().trim().min(1, "Task name is required").max(255, "Task name is too long")

function normalizeTaskName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO")
}

function revalidateWorkLog() {
  revalidatePath("/lms-analysis/work-log")
  revalidatePath("/lms-analysis/data")
}

function handleActionError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false as const, error: "A task with this name already exists" }
  }
  return { success: false as const, error: getActionErrorMessage(error, fallback) }
}

async function resolveEntryReferences(
  tenantId: string,
  lmsAllocationId: string,
  taskTypeId: string
) {
  const [client, task] = await Promise.all([
    prisma.lmsAllocation.findFirst({
      where: { id: lmsAllocationId, tenantId },
      select: { id: true, client: true },
    }),
    prisma.lmsWorkTask.findFirst({
      where: { id: taskTypeId, tenantId, isActive: true },
      select: { id: true, name: true },
    }),
  ])

  if (!client) throw new ActionError("LMS_CLIENT_NOT_FOUND", "Select a client from LMS Projects")
  if (!task) throw new ActionError("TASK_NOT_FOUND", "Select an active predefined task")
  return { client, task }
}

export async function createLmsWorkEntry(data: LmsWorkEntryInput) {
  try {
    const session = await requireTenantContext()
    const validated = WorkEntryInputSchema.parse(data)
    const { client, task } = await resolveEntryReferences(
      session.tenantId,
      validated.lmsAllocationId,
      validated.taskTypeId
    )

    const entry = await prisma.lmsWorkEntry.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
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
    const session = await requireTenantContext()
    const validatedId = EntryIdSchema.parse(entryId)
    const validated = WorkEntryUpdateInputSchema.parse(data)
    const existing = await prisma.lmsWorkEntry.findFirst({
      where: { id: validatedId, tenantId: session.tenantId, userId: session.userId },
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
            where: { id: validated.lmsAllocationId, tenantId: session.tenantId },
            select: { id: true, client: true },
          })
        : null,
      taskChanged
        ? prisma.lmsWorkTask.findFirst({
            where: { id: validated.taskTypeId, tenantId: session.tenantId, isActive: true },
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
    const session = await requireTenantContext()
    const validatedId = EntryIdSchema.parse(entryId)
    const existing = await prisma.lmsWorkEntry.findFirst({
      where: { id: validatedId, tenantId: session.tenantId, userId: session.userId },
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

export async function createLmsWorkTask(name: string) {
  try {
    const session = await requireTenantContext()
    const validatedName = canonicalizeLmsWorkTaskName(TaskNameSchema.parse(name))
    const task = await prisma.$transaction(async (tx) => {
      const aggregate = await tx.lmsWorkTask.aggregate({
        where: { tenantId: session.tenantId },
        _max: { sortOrder: true },
      })
      return tx.lmsWorkTask.create({
        data: {
          tenantId: session.tenantId,
          name: validatedName,
          normalizedName: normalizeTaskName(validatedName),
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      })
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_TASK_CREATED",
      details: `taskId=${task.id}`,
    })
    revalidateWorkLog()
    return { success: true as const, id: task.id }
  } catch (error) {
    return handleActionError(error, "Failed to add task")
  }
}

export async function reorderLmsWorkTasks(taskIds: string[]) {
  try {
    const session = await requireTenantContext()
    const orderedIds = TaskOrderSchema.parse(taskIds)
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ActionError("INVALID_TASK_ORDER", "Task order contains duplicates")
    }

    const existing = await prisma.lmsWorkTask.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((task) => task.id))
    if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id))) {
      throw new ActionError("INVALID_TASK_ORDER", "Refresh the catalog before reordering tasks")
    }

    await prisma.$transaction(
      orderedIds.map((id, sortOrder) => prisma.lmsWorkTask.updateMany({
        where: { id, tenantId: session.tenantId },
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
  data: { name: string; isActive: boolean }
) {
  try {
    const session = await requireTenantContext()
    const validatedId = TaskIdSchema.parse(taskId)
    const validated = z.object({ name: TaskNameSchema, isActive: z.boolean() }).parse(data)
    const name = canonicalizeLmsWorkTaskName(validated.name)
    const existing = await prisma.lmsWorkTask.findFirst({
      where: { id: validatedId, tenantId: session.tenantId },
      select: { id: true },
    })
    if (!existing) throw new ActionError("TASK_NOT_FOUND", "Predefined task not found")

    await prisma.lmsWorkTask.update({
      where: { id: existing.id },
      data: {
        name,
        normalizedName: normalizeTaskName(name),
        isActive: validated.isActive,
      },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_TASK_UPDATED",
      details: `taskId=${existing.id}; active=${validated.isActive}`,
    })
    revalidateWorkLog()
    return { success: true as const }
  } catch (error) {
    return handleActionError(error, "Failed to update task")
  }
}
