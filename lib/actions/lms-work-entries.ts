"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { DateOnlySchema } from "@/lib/lms-work-entries/date"
import type { LmsWorkEntryInput } from "@/lib/lms-work-entries/types"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"

const EntryIdSchema = z.string().uuid()
const TaskIdSchema = z.string().uuid()
const WorkEntryInputSchema = z.object({
  workDate: DateOnlySchema,
  projectId: z.string().uuid("Select a valid client project"),
  taskTypeId: z.string().uuid("Select a valid task"),
  durationMinutes: z.number().int("Minutes must be a whole number").min(1, "Minutes must be at least 1").max(1440, "Minutes cannot exceed 1440"),
})
const TaskNameSchema = z.string().trim().min(1, "Task name is required").max(255, "Task name is too long")

function normalizeTaskName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO")
}

function revalidateWorkLog() {
  revalidatePath("/lms-analysis/work-log")
}

function handleActionError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false as const, error: "A task with this name already exists" }
  }
  return { success: false as const, error: getActionErrorMessage(error, fallback) }
}

async function resolveEntryReferences(
  tenantId: string,
  projectId: string,
  taskTypeId: string,
  options?: { allowInactiveTaskId?: string }
) {
  const [project, task] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, tenantId, status: "Active" },
      select: { id: true, site: { select: { domainName: true } } },
    }),
    prisma.lmsWorkTask.findFirst({
      where: {
        id: taskTypeId,
        tenantId,
        ...(options?.allowInactiveTaskId === taskTypeId ? {} : { isActive: true }),
      },
      select: { id: true, name: true },
    }),
  ])

  if (!project) throw new ActionError("PROJECT_NOT_FOUND", "Select an active client project")
  if (!task) throw new ActionError("TASK_NOT_FOUND", "Select an active predefined task")
  return { project, task }
}

export async function createLmsWorkEntry(data: LmsWorkEntryInput) {
  try {
    const session = await requireTenantContext()
    const validated = WorkEntryInputSchema.parse(data)
    const [{ project, task }, user] = await Promise.all([
      resolveEntryReferences(session.tenantId, validated.projectId, validated.taskTypeId),
      prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: { name: true, username: true },
      }),
    ])
    if (!user) throw new ActionError("USER_NOT_FOUND", "Your user profile could not be loaded")

    const entry = await prisma.lmsWorkEntry.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        projectId: project.id,
        taskTypeId: task.id,
        workDate: validated.workDate,
        durationMinutes: validated.durationMinutes,
        clientDomainSnapshot: project.site.domainName,
        taskNameSnapshot: task.name,
        employeeNameSnapshot: user.name?.trim() || user.username,
      },
      select: { id: true },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRY_CREATED",
      details: `entryId=${entry.id}; projectId=${project.id}; workDate=${validated.workDate}`,
    })
    revalidateWorkLog()
    return { success: true as const, id: entry.id }
  } catch (error) {
    return handleActionError(error, "Failed to save work entry")
  }
}

export async function updateLmsWorkEntry(entryId: string, data: LmsWorkEntryInput) {
  try {
    const session = await requireTenantContext()
    const validatedId = EntryIdSchema.parse(entryId)
    const validated = WorkEntryInputSchema.parse(data)
    const existing = await prisma.lmsWorkEntry.findFirst({
      where: { id: validatedId, tenantId: session.tenantId, userId: session.userId },
      select: { id: true, taskTypeId: true },
    })
    if (!existing) throw new ActionError("ENTRY_NOT_FOUND", "Work entry not found")

    const { project, task } = await resolveEntryReferences(
      session.tenantId,
      validated.projectId,
      validated.taskTypeId,
      { allowInactiveTaskId: existing.taskTypeId }
    )
    await prisma.lmsWorkEntry.update({
      where: { id: existing.id },
      data: {
        projectId: project.id,
        taskTypeId: task.id,
        workDate: validated.workDate,
        durationMinutes: validated.durationMinutes,
        clientDomainSnapshot: project.site.domainName,
        taskNameSnapshot: task.name,
      },
    })
    await logSessionAuditEvent(session, {
      action: "LMS_WORK_ENTRY_UPDATED",
      details: `entryId=${existing.id}; projectId=${project.id}; workDate=${validated.workDate}`,
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
    const validatedName = TaskNameSchema.parse(name).replace(/\s+/g, " ")
    const task = await prisma.lmsWorkTask.create({
      data: {
        tenantId: session.tenantId,
        name: validatedName,
        normalizedName: normalizeTaskName(validatedName),
      },
      select: { id: true },
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

export async function updateLmsWorkTask(
  taskId: string,
  data: { name: string; isActive: boolean }
) {
  try {
    const session = await requireTenantContext()
    const validatedId = TaskIdSchema.parse(taskId)
    const validated = z.object({ name: TaskNameSchema, isActive: z.boolean() }).parse(data)
    const name = validated.name.replace(/\s+/g, " ")
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

