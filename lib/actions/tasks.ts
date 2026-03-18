"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireTenantContext } from "@/lib/tenant"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { TASK_STATUS_VALUES, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { z } from "zod"

function revalidateTaskPaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/tasks")
    revalidatePath("/projects")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) {
        revalidatePath(`/partners/${sitePartnerId}/${siteId}`)
        revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
    }
}

const TaskStatusSchema = z.enum(TASK_STATUS_VALUES)
const LegacyTaskStatusSchema = z.enum(["Active", "Paused", "Completed"])
const TaskUrgencySchema = z.enum(["Low", "Normal", "High", "Urgent", "Idea"])
const TaskIdSchema = z.string().uuid()
const TaskIdsSchema = z.array(TaskIdSchema).max(500)
const ProjectIdSchema = z.string().uuid()

function formatAuditDateToken(value: Date | null | undefined) {
    if (!value) return "none"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "invalid"
    return parsed.toISOString()
}

const AddTaskSchema = z.object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(1, "Task name is required").max(255),
    options: z.object({
        deadline: z.date().optional(),
        status: TaskStatusSchema.optional(),
        urgency: TaskUrgencySchema.optional(),
        estimatedMinutes: z.number().int().min(0).max(100000).optional(),
    }).optional(),
})

const UpdateTaskSchema = z.object({
    taskId: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(50000).optional(),
    status: TaskStatusSchema.optional(),
    urgency: TaskUrgencySchema.optional(),
    isCompleted: z.boolean().optional(),
    deadline: z.union([z.date(), z.null()]).optional(),
    estimatedMinutes: z.union([z.number().int().min(0).max(100000), z.null()]).optional(),
})

export async function addTask(projectId: string, name: string, options?: { deadline?: Date, status?: string, urgency?: string, estimatedMinutes?: number }) {
    try {
        const session = await requireTenantContext()
        const validated = AddTaskSchema.parse({ projectId, name, options })
        const project = await prisma.project.findFirst({
            where: { id: validated.projectId, tenantId: session.tenantId },
            select: { id: true },
        })
        if (!project) {
            await logSessionAuditEvent(session, {
                action: "TASK_CREATE_FAILED",
                success: false,
                details: `projectId=${validated.projectId}; reason=project_not_found`,
            })
            return { success: false, error: "Project not found" }
        }
        const task = await prisma.task.create({
            data: {
                tenantId: session.tenantId,
                projectId: validated.projectId,
                name: validated.name,
                status: validated.options?.status || "Active",
                urgency: normalizeTaskUrgency(validated.options?.urgency),
                deadline: validated.options?.deadline,
                estimatedMinutes: validated.options?.estimatedMinutes
            },
            include: { project: { include: { site: true } } }
        })
        await logSessionAuditEvent(session, {
            action: "TASK_CREATED",
            details: `taskId=${task.id}; projectId=${validated.projectId}; status=${task.status}; priority=${task.urgency}; deadline=${formatAuditDateToken(task.deadline)}`,
        })
        revalidateTaskPaths(validated.projectId, task.project?.site?.partnerId, task.project?.siteId)
        return { success: true }
    } catch (error) {
        console.error("Add task failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to add task") }
    }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string, projectId: string) {
    try {
        const session = await requireTenantContext()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const validatedCurrentStatus = LegacyTaskStatusSchema.parse(currentStatus)
        const normalizedCurrentStatus = normalizeTaskStatus(validatedCurrentStatus)
        const isCompleted = normalizedCurrentStatus === "Completed"
        const newStatus = isCompleted ? "Active" : "Completed"

        const taskEntity = await prisma.task.findFirst({
            where: { id: validatedTaskId, tenantId: session.tenantId },
            select: { id: true },
        })
        if (!taskEntity) {
            await logSessionAuditEvent(session, {
                action: "TASK_STATUS_TOGGLE_FAILED",
                success: false,
                details: `taskId=${validatedTaskId}; reason=not_found`,
            })
            return { success: false, error: "Task not found" }
        }

        const task = await prisma.task.update({
            where: { id: taskEntity.id },
            data: {
                status: newStatus,
            },
            include: { project: { include: { site: true } } }
        })
        await logSessionAuditEvent(session, {
            action: "TASK_STATUS_TOGGLED",
            details: `taskId=${validatedTaskId}; from=${normalizedCurrentStatus}; to=${newStatus}`,
        })
        await logSessionAuditEvent(session, {
            action: "TASK_STATUS_CHANGED",
            details: `taskId=${validatedTaskId}; projectId=${validatedProjectId}; from=${normalizedCurrentStatus}; to=${newStatus}; source=toggle_status`,
        })
        revalidateTaskPaths(validatedProjectId, task.project.site.partnerId, task.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Toggle task status failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to toggle task status") }
    }
}

export async function updateTask(taskId: string, data: {
    name?: string
    description?: string
    status?: string
    urgency?: string
    isCompleted?: boolean
    deadline?: Date | null
    estimatedMinutes?: number | null
}) {
    try {
        const session = await requireTenantContext()
        const validated = UpdateTaskSchema.parse({ taskId, ...data })
        const { isCompleted, taskId: validatedTaskId, ...restData } = validated
        const updateData: Prisma.TaskUpdateInput = { ...restData }
        if (restData.urgency !== undefined) {
            updateData.urgency = normalizeTaskUrgency(restData.urgency)
        }

        if (isCompleted === true) {
            updateData.status = "Completed"
        } else if (isCompleted === false && !data.status) {
            updateData.status = "Active"
        }

        const existingTask = await prisma.task.findFirst({
            where: { id: validatedTaskId, tenantId: session.tenantId },
            select: { id: true, projectId: true, status: true, urgency: true, deadline: true },
        })
        if (!existingTask) {
            await logSessionAuditEvent(session, {
                action: "TASK_UPDATE_FAILED",
                success: false,
                details: `taskId=${validatedTaskId}; reason=not_found`,
            })
            return { success: false, error: "Task not found" }
        }

        const task = await prisma.task.update({
            where: { id: existingTask.id },
            data: updateData,
            include: { project: { include: { site: true } } }
        })

        const nextStatus = typeof updateData.status === "string" ? updateData.status : existingTask.status
        const nextPriority = typeof updateData.urgency === "string" ? updateData.urgency : existingTask.urgency
        const nextDeadline = updateData.deadline === undefined ? existingTask.deadline : ((updateData.deadline as Date | null) ?? null)

        if (nextStatus !== existingTask.status) {
            await logSessionAuditEvent(session, {
                action: "TASK_STATUS_CHANGED",
                details: `taskId=${task.id}; projectId=${task.projectId}; from=${existingTask.status}; to=${nextStatus}; source=update_task`,
            })
        }

        if (nextPriority !== existingTask.urgency) {
            await logSessionAuditEvent(session, {
                action: "TASK_PRIORITY_CHANGED",
                details: `taskId=${task.id}; projectId=${task.projectId}; from=${existingTask.urgency}; to=${nextPriority}; source=update_task`,
            })
        }

        if (formatAuditDateToken(nextDeadline) !== formatAuditDateToken(existingTask.deadline)) {
            await logSessionAuditEvent(session, {
                action: "TASK_DEADLINE_CHANGED",
                details: `taskId=${task.id}; projectId=${task.projectId}; from=${formatAuditDateToken(existingTask.deadline)}; to=${formatAuditDateToken(nextDeadline)}; source=update_task`,
            })
        }

        await logSessionAuditEvent(session, {
            action: "TASK_UPDATED",
            details: `taskId=${task.id}; projectId=${task.projectId}`,
        })
        revalidateTaskPaths(task.projectId, task.project.site.partnerId, task.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Update task failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to update task") }
    }
}

export async function deleteTask(taskId: string, projectId: string) {
    try {
        const session = await requireTenantContext()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const task = await prisma.task.findFirst({
            where: { id: validatedTaskId, tenantId: session.tenantId },
            include: { project: { include: { site: true } } }
        })
        if (!task) {
            await logSessionAuditEvent(session, {
                action: "TASK_DELETE_FAILED",
                success: false,
                details: `taskId=${validatedTaskId}; reason=not_found`,
            })
            return { success: false, error: "Task not found" }
        }
        await prisma.task.delete({ where: { id: task.id } })
        await logSessionAuditEvent(session, {
            action: "TASK_DELETED",
            details: `taskId=${task.id}; projectId=${task.projectId}`,
        })
        revalidateTaskPaths(validatedProjectId, task.project.site.partnerId, task.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Delete task failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete task") }
    }
}

export async function deleteTasks(taskIds: string[]) {
    try {
        const session = await requireTenantContext()
        const validatedTaskIds = TaskIdsSchema.parse(taskIds)
        if (validatedTaskIds.length === 0) return { success: true }
        const deleted = await prisma.task.deleteMany({
            where: { id: { in: validatedTaskIds }, tenantId: session.tenantId }
        })
        await logSessionAuditEvent(session, {
            action: "TASKS_BULK_DELETED",
            details: `requested=${validatedTaskIds.length}; deleted=${deleted.count}`,
        })
        revalidateTaskPaths()
        return { success: true }
    } catch (error) {
        console.error("Bulk delete tasks failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete tasks") }
    }
}

export async function updateTasksStatus(taskIds: string[], status: string) {
    try {
        const session = await requireTenantContext()
        const validatedTaskIds = TaskIdsSchema.parse(taskIds)
        const validatedStatus = TaskStatusSchema.parse(status)
        if (validatedTaskIds.length === 0) return { success: true }
        const updated = await prisma.task.updateMany({
            where: { id: { in: validatedTaskIds }, tenantId: session.tenantId },
            data: { status: validatedStatus }
        })
        await logSessionAuditEvent(session, {
            action: "TASKS_BULK_STATUS_UPDATED",
            details: `count=${updated.count}; status=${validatedStatus}`,
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk update tasks status failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to update tasks") }
    }
}

export async function getTaskHistory(taskId: string) {
    try {
        const session = await requireTenantContext()
        const validatedTaskId = TaskIdSchema.parse(taskId)

        const logs = await prisma.auditLog.findMany({
            where: {
                tenantId: session.tenantId,
                action: {
                    in: [
                        "TASK_CREATED",
                        "TASK_STATUS_CHANGED",
                        "TASK_PRIORITY_CHANGED",
                        "TASK_DEADLINE_CHANGED",
                    ],
                },
                details: { contains: `taskId=${validatedTaskId}` },
            },
            orderBy: { createdAt: "desc" },
            take: 40,
        })

        return {
            success: true,
            data: logs.map((log) => {
                const details = log.details || ""
                const fromMatch = details.match(/(?:^|;\s*)from=([^;]+)/)
                const toMatch = details.match(/(?:^|;\s*)to=([^;]+)/)
                const sourceMatch = details.match(/(?:^|;\s*)source=([^;]+)/)
                const statusMatch = details.match(/(?:^|;\s*)status=([^;]+)/)
                const priorityMatch = details.match(/(?:^|;\s*)priority=([^;]+)/)
                const deadlineMatch = details.match(/(?:^|;\s*)deadline=([^;]+)/)

                return {
                    id: log.id,
                    action: log.action,
                    date: log.createdAt,
                    from: fromMatch?.[1]?.trim() || null,
                    to: toMatch?.[1]?.trim() || null,
                    status: statusMatch?.[1]?.trim() || null,
                    priority: priorityMatch?.[1]?.trim() || null,
                    deadline: deadlineMatch?.[1]?.trim() || null,
                    source: sourceMatch?.[1]?.trim() || null,
                }
            }),
        }
    } catch (error) {
        console.error("Get task history failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to fetch task history") }
    }
}
