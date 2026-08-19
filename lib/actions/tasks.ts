"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { LMS_CRM_EMPLOYEE_NAME } from "@/lib/lms-work-entries/crm-template"
import { TASK_STATUS_VALUES, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { formatProjectName } from "@/lib/utils"
import {
    buildCrmTaskWorkEntrySourceKey,
    buildTaskTargetInput,
    inferTaskScope,
    LmsTaskCompletionSchema,
    TaskScopeSchema,
    type LmsTaskCompletionInput,
    type TaskScope,
} from "@/lib/tasks/lms-bridge"
import {
    hasCurrentNotesWriteProtocol,
    NOTES_CLIENT_REFRESH_MESSAGE,
    NOTES_CLIENT_REFRESH_REQUIRED,
} from "@/lib/notes/write-protocol"
import { MAX_TASK_ESTIMATED_MINUTES } from "@/lib/tasks/estimated-time"
import { getBucharestDateOnly, getDefaultLmsWorkDate } from "@/lib/lms-work-entries/date"
import { z } from "zod"
import { normalizeRichTextContent } from "@/lib/notes/content"
import { syncOutboundTaskCreate, syncOutboundTaskComplete } from "@/lib/integrations/ticktick/sync"

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
const LegacyTaskStatusSchema = z.enum(["Active", "Paused", "Pending", "Completed", "Done"])
const TaskUrgencySchema = z.enum(["Low", "Normal", "High", "Urgent", "Idea"])
const TaskIdSchema = z.string().uuid()
const TaskIdsSchema = z.array(TaskIdSchema).max(500)
const ProjectIdSchema = z.string().uuid()
const OptionalLmsReferenceSchema = z.string().uuid().nullable().optional()

const taskContextSelect = {
    id: true,
    projectId: true,
    taskScope: true,
    lmsAllocationId: true,
    lmsTaskTypeId: true,
    name: true,
    status: true,
    urgency: true,
    deadline: true,
    timeLogs: {
        where: { durationSeconds: { not: null } },
        orderBy: [{ startTime: "desc" as const }, { createdAt: "desc" as const }],
        select: { durationSeconds: true, startTime: true },
    },
    project: {
        select: {
            siteId: true,
            site: {
                select: {
                    partnerId: true,
                },
            },
        },
    },
} satisfies Prisma.TaskSelect

export async function getTaskCompletionReadiness(taskId: string) {
    try {
        await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const task = await prisma.task.findUnique({
            where: { id: validatedTaskId },
            select: {
                id: true,
                taskScope: true,
                projectId: true,
                status: true,
                lmsAllocationId: true,
                lmsTaskTypeId: true,
                timeLogs: {
                    where: { durationSeconds: { not: null } },
                    select: { durationSeconds: true },
                },
            },
        })
        if (!task) throw new ActionError("TASK_NOT_FOUND", "Task not found")

        const trackedSeconds = task.timeLogs.reduce(
            (total, log) => total + Math.max(0, log.durationSeconds || 0),
            0
        )
        return {
            success: true as const,
            data: {
                status: task.status,
                taskScope: normalizeStoredTaskScope(task.taskScope, task.projectId),
                trackedMinutes: trackedSeconds > 0 ? Math.max(1, Math.round(trackedSeconds / 60)) : 0,
                lmsAllocationId: task.lmsAllocationId,
                lmsTaskTypeId: task.lmsTaskTypeId,
            },
        }
    } catch (error) {
        return taskActionFailure(error, "Failed to check task time")
    }
}

function taskActionFailure(error: unknown, fallback: string) {
    return {
        success: false as const,
        error: getActionErrorMessage(error, fallback),
        ...(error instanceof ActionError ? { code: error.code } : {}),
    }
}

function isPrismaUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function normalizeStoredTaskScope(value: string | null | undefined, projectId?: string | null): TaskScope {
    if (projectId) return "FREELANCE"
    const parsed = TaskScopeSchema.safeParse(value)
    return parsed.success ? parsed.data : inferTaskScope(projectId)
}

function revalidateLmsTaskPaths() {
    revalidatePath("/lms-analysis/work-log")
    revalidatePath("/lms-analysis/data")
}

async function resolveLmsTaskMapping(
    tx: Prisma.TransactionClient,
    lmsAllocationId: string | null | undefined,
    lmsTaskTypeId: string | null | undefined
) {
    const [allocation, taskType] = await Promise.all([
        lmsAllocationId
            ? tx.lmsAllocation.findUnique({
                where: { id: lmsAllocationId },
                select: { id: true, client: true },
            })
            : Promise.resolve(null),
        lmsTaskTypeId
            ? tx.lmsWorkTask.findUnique({
                where: { id: lmsTaskTypeId },
                select: { id: true, name: true, isActive: true },
            })
            : Promise.resolve(null),
    ])

    if (lmsAllocationId && !allocation) {
        throw new ActionError("LMS_ALLOCATION_NOT_FOUND", "Select a current LMS project")
    }
    if (lmsTaskTypeId && (!taskType || !taskType.isActive)) {
        throw new ActionError("LMS_TASK_TYPE_NOT_FOUND", "Select an active LMS task type")
    }

    return { allocation, taskType }
}

function assertTaskScopeProject(scope: TaskScope, projectId: string | null) {
    if (scope === "FREELANCE" && !projectId) {
        throw new ActionError("FREELANCE_PROJECT_REQUIRED", "Select a freelance project")
    }
    if (scope !== "FREELANCE" && projectId) {
        throw new ActionError(
            "TASK_SCOPE_PROJECT_CONFLICT",
            scope === "LMS"
                ? "LMS tasks cannot belong to a freelance project"
                : "General tasks cannot belong to a freelance project"
        )
    }
}

function formatAuditDateToken(value: Date | null | undefined) {
    if (!value) return "none"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "invalid"
    return parsed.toISOString()
}

const AddTaskSchema = z.object({
    projectId: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(1, "Task name is required").max(255),
    options: z.object({
        deadline: z.date().optional(),
        status: TaskStatusSchema.optional(),
        urgency: TaskUrgencySchema.optional(),
        estimatedMinutes: z.number().int().min(1).max(MAX_TASK_ESTIMATED_MINUTES).optional(),
        taskScope: TaskScopeSchema.optional(),
        lmsAllocationId: OptionalLmsReferenceSchema,
        lmsTaskTypeId: OptionalLmsReferenceSchema,
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
    estimatedMinutes: z.union([
        z.number().int().min(1).max(MAX_TASK_ESTIMATED_MINUTES),
        z.null(),
    ]).optional(),
    projectId: z.string().uuid().nullable().optional(),
    taskScope: TaskScopeSchema.optional(),
    lmsAllocationId: OptionalLmsReferenceSchema,
    lmsTaskTypeId: OptionalLmsReferenceSchema,
})

export async function addTask(
    projectId: string | null | undefined,
    name: string,
    options?: {
        deadline?: Date
        status?: string
        urgency?: string
        estimatedMinutes?: number
        taskScope?: TaskScope
        lmsAllocationId?: string | null
        lmsTaskTypeId?: string | null
    }
) {
    try {
        const session = await requireAuth()
        const validated = AddTaskSchema.parse({ projectId, name, options })

        const taskResult = await prisma.$transaction(async (tx) => {
            const selectedProjectId = validated.projectId?.trim()
            let targetProject: { id: string; siteId: string; site: { partnerId: string } } | null = null

            if (selectedProjectId) {
                targetProject = await tx.project.findFirst({
                    where: { id: selectedProjectId },
                    select: {
                        id: true,
                        siteId: true,
                        site: {
                            select: {
                                partnerId: true,
                            },
                        },
                    },
                })
                if (!targetProject) {
                    return {
                        ok: false as const,
                        reason: "project_not_found",
                    }
                }
            }

            const taskScope = validated.options?.taskScope ?? inferTaskScope(targetProject?.id)
            assertTaskScopeProject(taskScope, targetProject?.id ?? null)
            if (taskScope === "GENERAL") {
                throw new ActionError(
                    "TASK_TARGET_REQUIRED",
                    "Choose a freelance project or LMS for this task"
                )
            }
            if (taskScope === "LMS" && validated.options?.status === "Completed") {
                throw new ActionError(
                    "LMS_COMPLETION_DETAILS_REQUIRED",
                    "Create the LMS task as active, then complete it with its project, task type, date, and duration"
                )
            }

            const lmsAllocationId = taskScope === "LMS"
                ? validated.options?.lmsAllocationId ?? null
                : null
            const lmsTaskTypeId = taskScope === "LMS"
                ? validated.options?.lmsTaskTypeId ?? null
                : null
            if (taskScope === "LMS") {
                await resolveLmsTaskMapping(tx, lmsAllocationId, lmsTaskTypeId)
            }
            const taskTarget = buildTaskTargetInput({
                taskScope,
                projectId: targetProject?.id,
                lmsAllocationId,
                lmsTaskTypeId,
            })

            const task = await tx.task.create({
                data: {
                    ...taskTarget,
                    name: validated.name,
                    status: validated.options?.status || "Active",
                    urgency: normalizeTaskUrgency(validated.options?.urgency),
                    deadline: validated.options?.deadline,
                    estimatedMinutes: validated.options?.estimatedMinutes,
                },
                include: {
                    project: {
                        include: {
                            site: true,
                        },
                    },
                },
            })

            return {
                ok: true as const,
                projectId: taskTarget.projectId,
                taskScope,
                task,
            }
        })

        if (!taskResult.ok) {
            await logSessionAuditEvent(session, {
                action: "TASK_CREATE_FAILED",
                success: false,
                details: `projectId=${validated.projectId || "none"}; reason=${taskResult.reason}`,
            })
            return { success: false, error: "Project not found" }
        }

        const task = taskResult.task
        await logSessionAuditEvent(session, {
            action: "TASK_CREATED",
            details: `taskId=${task.id}; projectId=${taskResult.projectId || "none"}; taskScope=${taskResult.taskScope}; status=${task.status}; priority=${task.urgency}; deadline=${formatAuditDateToken(task.deadline)}`,
        })
        revalidateTaskPaths(taskResult.projectId || undefined, task.project?.site?.partnerId, task.project?.siteId)
        void syncOutboundTaskCreate(task.id)
        return {
            success: true,
            data: {
                taskId: task.id,
                projectId: taskResult.projectId,
                taskScope: taskResult.taskScope,
                lmsAllocationId: task.lmsAllocationId,
                lmsTaskTypeId: task.lmsTaskTypeId,
                projectName: task.project?.name || null,
                projectDomain: task.project?.site?.domainName || null,
            },
        }
    } catch (error) {
        console.error("Add task failed:", error)
        return taskActionFailure(error, "Failed to add task")
    }
}

export async function completeTask(
    taskId: string,
    lmsCompletion?: LmsTaskCompletionInput
) {
    try {
        const session = await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const validatedCompletion = lmsCompletion === undefined
            ? undefined
            : LmsTaskCompletionSchema.parse(lmsCompletion)

        const runCompletion = () => prisma.$transaction(async (tx) => {
            const task = await tx.task.findUnique({
                where: { id: validatedTaskId },
                select: taskContextSelect,
            })
            if (!task) throw new ActionError("TASK_NOT_FOUND", "Task not found")

            const taskScope = normalizeStoredTaskScope(task.taskScope, task.projectId)
            const existingEntry = taskScope === "LMS"
                ? await tx.lmsWorkEntry.findUnique({
                    where: { crmTaskId: task.id },
                    select: { id: true, exportedAt: true },
                })
                : null

            if (task.status === "Completed" && (taskScope !== "LMS" || existingEntry)) {
                return {
                    task,
                    previousStatus: task.status,
                    lmsEntryCreated: false,
                    lmsEntryId: existingEntry?.id ?? null,
                    lmsEntryAlreadyExists: Boolean(existingEntry),
                }
            }

            if (taskScope !== "LMS") {
                await tx.task.update({
                    where: { id: task.id },
                    data: { status: "Completed" },
                })
                return {
                    task,
                    previousStatus: task.status,
                    lmsEntryCreated: false,
                    lmsEntryId: null,
                    lmsEntryAlreadyExists: false,
                }
            }

            if (existingEntry) {
                await tx.task.update({
                    where: { id: task.id },
                    data: { status: "Completed" },
                })
                return {
                    task,
                    previousStatus: task.status,
                    lmsEntryCreated: false,
                    lmsEntryId: existingEntry.id,
                    lmsEntryAlreadyExists: true,
                }
            }

            const trackedSeconds = task.timeLogs.reduce(
                (total, log) => total + Math.max(0, log.durationSeconds || 0),
                0
            )
            const trackedMinutes = trackedSeconds > 0
                ? Math.max(1, Math.round(trackedSeconds / 60))
                : 0
            const completionAllocationId = task.lmsAllocationId || validatedCompletion?.lmsAllocationId
            const completionTaskTypeId = task.lmsTaskTypeId || validatedCompletion?.lmsTaskTypeId

            if (!trackedMinutes && !validatedCompletion) {
                throw new ActionError(
                    "LMS_COMPLETION_DETAILS_REQUIRED",
                    "Select the LMS project, task type, work date, and duration before completing this task"
                )
            }

            if (!completionAllocationId || !completionTaskTypeId) {
                throw new ActionError(
                    "LMS_COMPLETION_DETAILS_REQUIRED",
                    "Select the LMS project and task type before completing this task"
                )
            }

            const { allocation, taskType } = await resolveLmsTaskMapping(
                tx,
                completionAllocationId,
                completionTaskTypeId
            )
            if (!allocation || !taskType) {
                throw new ActionError(
                    "LMS_COMPLETION_DETAILS_REQUIRED",
                    "Select the LMS project and an active LMS task type"
                )
            }

            await tx.task.update({
                where: { id: task.id },
                data: {
                    projectId: null,
                    taskScope: "LMS",
                    lmsAllocationId: allocation.id,
                    lmsTaskTypeId: taskType.id,
                    status: "Completed",
                },
            })
            const entry = await tx.lmsWorkEntry.create({
                data: {
                    lmsAllocationId: allocation.id,
                    taskTypeId: taskType.id,
                    crmTaskId: task.id,
                    workDate: trackedMinutes && task.timeLogs[0]?.startTime
                        ? getDefaultLmsWorkDate(getBucharestDateOnly(task.timeLogs[0].startTime))
                        : validatedCompletion!.workDate,
                    durationMinutes: trackedMinutes || validatedCompletion!.durationMinutes,
                    clientDomainSnapshot: allocation.client,
                    taskNameSnapshot: taskType.name,
                    crmTaskNameSnapshot: task.name,
                    employeeNameSnapshot: LMS_CRM_EMPLOYEE_NAME,
                    origin: "CRM_TASK",
                    sourceKey: buildCrmTaskWorkEntrySourceKey(task.id),
                },
                select: { id: true },
            })

            return {
                task,
                previousStatus: task.status,
                lmsEntryCreated: true,
                lmsEntryId: entry.id,
                lmsEntryAlreadyExists: false,
            }
        })

        let result: Awaited<ReturnType<typeof runCompletion>>
        try {
            result = await runCompletion()
        } catch (error) {
            if (!isPrismaUniqueConstraintError(error)) throw error

            const [task, existingEntry] = await Promise.all([
                prisma.task.findUnique({
                    where: { id: validatedTaskId },
                    select: taskContextSelect,
                }),
                prisma.lmsWorkEntry.findUnique({
                    where: { crmTaskId: validatedTaskId },
                    select: { id: true },
                }),
            ])
            if (!task || task.status !== "Completed" || !existingEntry) throw error

            result = {
                task,
                previousStatus: "Completed",
                lmsEntryCreated: false,
                lmsEntryId: existingEntry.id,
                lmsEntryAlreadyExists: true,
            }
        }

        if (result.previousStatus !== "Completed") {
            await logSessionAuditEvent(session, {
                action: "TASK_STATUS_CHANGED",
                details: `taskId=${result.task.id}; projectId=${result.task.projectId || "none"}; from=${result.previousStatus}; to=Completed; source=complete_task`,
            })
        }
        if (result.lmsEntryCreated && result.lmsEntryId) {
            await logSessionAuditEvent(session, {
                action: "LMS_WORK_ENTRY_CREATED_FROM_TASK",
                details: `taskId=${result.task.id}; entryId=${result.lmsEntryId}; source=crm_task`,
            })
        }

        revalidateTaskPaths(
            result.task.projectId || undefined,
            result.task.project?.site?.partnerId,
            result.task.project?.siteId
        )
        if (result.lmsEntryId) revalidateLmsTaskPaths()
        void syncOutboundTaskComplete(result.task.id)
        return {
            success: true as const,
            data: {
                lmsEntryCreated: result.lmsEntryCreated,
                lmsEntryId: result.lmsEntryId,
                lmsEntryAlreadyExists: result.lmsEntryAlreadyExists,
            },
        }
    } catch (error) {
        console.error("Complete task failed:", error)
        return taskActionFailure(error, "Failed to complete task")
    }
}

export async function reopenTask(taskId: string) {
    try {
        const session = await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const result = await prisma.$transaction(async (tx) => {
            const task = await tx.task.findUnique({
                where: { id: validatedTaskId },
                select: taskContextSelect,
            })
            if (!task) throw new ActionError("TASK_NOT_FOUND", "Task not found")

            const entry = await tx.lmsWorkEntry.findUnique({
                where: { crmTaskId: task.id },
                select: { id: true, exportedAt: true },
            })
            const entryDeleted = Boolean(entry && !entry.exportedAt)
            const exportedEntryPreserved = Boolean(entry?.exportedAt)

            if (entryDeleted && entry) {
                await tx.lmsWorkEntry.delete({ where: { id: entry.id } })
            }
            if (task.status !== "Active") {
                await tx.task.update({
                    where: { id: task.id },
                    data: { status: "Active" },
                })
            }

            return {
                task,
                previousStatus: task.status,
                entryId: entry?.id ?? null,
                entryDeleted,
                exportedEntryPreserved,
            }
        })

        if (result.previousStatus !== "Active") {
            await logSessionAuditEvent(session, {
                action: "TASK_STATUS_CHANGED",
                details: `taskId=${result.task.id}; projectId=${result.task.projectId || "none"}; from=${result.previousStatus}; to=Active; source=reopen_task`,
            })
        }
        if (result.entryDeleted && result.entryId) {
            await logSessionAuditEvent(session, {
                action: "LMS_WORK_ENTRY_REMOVED_ON_TASK_REOPEN",
                details: `taskId=${result.task.id}; entryId=${result.entryId}; source=crm_task`,
            })
        }

        revalidateTaskPaths(
            result.task.projectId || undefined,
            result.task.project?.site?.partnerId,
            result.task.project?.siteId
        )
        if (result.entryId) revalidateLmsTaskPaths()
        const warning = result.exportedEntryPreserved
            ? "The exported LMS work entry was preserved; reopening the task does not remove exported history."
            : undefined
        return {
            success: true as const,
            ...(warning ? { warning } : {}),
            data: {
                entryDeleted: result.entryDeleted,
                exportedEntryPreserved: result.exportedEntryPreserved,
            },
        }
    } catch (error) {
        console.error("Reopen task failed:", error)
        return taskActionFailure(error, "Failed to reopen task")
    }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string, projectId?: string | null) {
    try {
        const session = await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        if (projectId) ProjectIdSchema.parse(projectId)
        LegacyTaskStatusSchema.parse(currentStatus)

        const taskEntity = await prisma.task.findFirst({
            where: { id: validatedTaskId },
            select: { id: true, status: true },
        })
        if (!taskEntity) {
            await logSessionAuditEvent(session, {
                action: "TASK_STATUS_TOGGLE_FAILED",
                success: false,
                details: `taskId=${validatedTaskId}; reason=not_found`,
            })
            return { success: false, error: "Task not found" }
        }

        const persistedStatus = normalizeTaskStatus(taskEntity.status)
        const result = persistedStatus === "Completed"
            ? await reopenTask(taskEntity.id)
            : await completeTask(taskEntity.id)
        if (!result.success) return result

        await logSessionAuditEvent(session, {
            action: "TASK_STATUS_TOGGLED",
            details: `taskId=${validatedTaskId}; from=${persistedStatus}; to=${persistedStatus === "Completed" ? "Active" : "Completed"}`,
        })
        return result
    } catch (error) {
        console.error("Toggle task status failed:", error)
        return taskActionFailure(error, "Failed to toggle task status")
    }
}

export async function updateTask(taskId: string, data: {
    name?: string
    description?: string
    urgency?: string
    deadline?: Date | null
    estimatedMinutes?: number | null
    projectId?: string | null
    taskScope?: TaskScope
    lmsAllocationId?: string | null
    lmsTaskTypeId?: string | null
}, options: { notesWriteProtocol?: string } = {}) {
    try {
        const session = await requireAuth()
        const validated = UpdateTaskSchema.parse({ taskId, ...data })
        if (validated.status !== undefined || validated.isCompleted !== undefined) {
            throw new ActionError(
                "TASK_STATUS_ACTION_REQUIRED",
                "Use the complete or reopen task action to change task status"
            )
        }
        const {
            taskId: validatedTaskId,
            projectId: requestedProjectId,
            taskScope: requestedScope,
            lmsAllocationId: requestedLmsAllocationId,
            lmsTaskTypeId: requestedLmsTaskTypeId,
        } = validated
        const editableFields = {
            ...(validated.name !== undefined ? { name: validated.name } : {}),
            ...(validated.description !== undefined
                ? { description: normalizeRichTextContent(validated.description) }
                : {}),
            ...(validated.urgency !== undefined ? { urgency: validated.urgency } : {}),
            ...(validated.deadline !== undefined ? { deadline: validated.deadline } : {}),
            ...(validated.estimatedMinutes !== undefined
                ? { estimatedMinutes: validated.estimatedMinutes }
                : {}),
        }
        if (
            validated.description !== undefined
            && !hasCurrentNotesWriteProtocol(options.notesWriteProtocol)
        ) {
            await logSessionAuditEvent(session, {
                action: "NOTE_WRITE_PROTOCOL_REJECTED",
                success: false,
                details: `taskId=${validatedTaskId}; reason=stale_notes_client`,
            })
            return {
                success: false,
                error: NOTES_CLIENT_REFRESH_MESSAGE,
                code: NOTES_CLIENT_REFRESH_REQUIRED,
            }
        }

        const mutation = await prisma.$transaction(async (tx) => {
            const existingTask = await tx.task.findUnique({
                where: { id: validatedTaskId },
                select: taskContextSelect,
            })
            if (!existingTask) throw new ActionError("TASK_NOT_FOUND", "Task not found")

            const storedScope = normalizeStoredTaskScope(existingTask.taskScope, existingTask.projectId)
            const nextScope = requestedScope ?? storedScope
            const nextProjectId = nextScope === "FREELANCE"
                ? requestedProjectId !== undefined
                    ? requestedProjectId
                    : storedScope === "FREELANCE" ? existingTask.projectId : null
                : null
            assertTaskScopeProject(nextScope, nextProjectId)
            if (nextProjectId) {
                const projectExists = await tx.project.findUnique({
                    where: { id: nextProjectId },
                    select: { id: true },
                })
                if (!projectExists) {
                    throw new ActionError("FREELANCE_PROJECT_NOT_FOUND", "Select a current freelance project")
                }
            }

            const nextLmsAllocationId = nextScope === "LMS"
                ? requestedLmsAllocationId !== undefined
                    ? requestedLmsAllocationId
                    : storedScope === "LMS" ? existingTask.lmsAllocationId : null
                : null
            const nextLmsTaskTypeId = nextScope === "LMS"
                ? requestedLmsTaskTypeId !== undefined
                    ? requestedLmsTaskTypeId
                    : storedScope === "LMS" ? existingTask.lmsTaskTypeId : null
                : null
            const nextTarget = buildTaskTargetInput({
                taskScope: nextScope,
                projectId: nextProjectId,
                lmsAllocationId: nextLmsAllocationId,
                lmsTaskTypeId: nextLmsTaskTypeId,
            })
            const targetChanged = nextTarget.taskScope !== storedScope
                || nextTarget.projectId !== existingTask.projectId
                || nextTarget.lmsAllocationId !== existingTask.lmsAllocationId
                || nextTarget.lmsTaskTypeId !== existingTask.lmsTaskTypeId
            const projectTargetChanged = nextTarget.projectId !== existingTask.projectId

            if (targetChanged) {
                if (projectTargetChanged) {
                    const activeTimer = await tx.timeLog.findFirst({
                        where: {
                            taskId: existingTask.id,
                            OR: [
                                { endTime: null },
                                { isPaused: true },
                            ],
                        },
                        select: { id: true },
                    })
                    if (activeTimer) {
                        throw new ActionError(
                            "TASK_TARGET_LOCKED_BY_ACTIVE_TIMER",
                            "Stop the task timer before changing its project or target"
                        )
                    }
                }
                if (existingTask.status === "Completed") {
                    throw new ActionError(
                        "TASK_TARGET_LOCKED_WHILE_COMPLETED",
                        "Reopen this task before changing its target"
                    )
                }
                const existingEntry = await tx.lmsWorkEntry.findUnique({
                    where: { crmTaskId: existingTask.id },
                    select: { exportedAt: true },
                })
                if (existingEntry) {
                    throw new ActionError(
                        "TASK_TARGET_LOCKED_BY_LMS_ENTRY",
                        existingEntry.exportedAt
                            ? "This task target cannot change because its LMS work entry was already exported"
                            : "Reopen this task before changing its LMS target"
                    )
                }
            }

            if (nextScope === "LMS") {
                await resolveLmsTaskMapping(tx, nextLmsAllocationId, nextLmsTaskTypeId)
            }

            const updateData: Prisma.TaskUncheckedUpdateInput = {
                ...editableFields,
                ...nextTarget,
            }
            if (editableFields.urgency !== undefined) {
                updateData.urgency = normalizeTaskUrgency(editableFields.urgency)
            }

            const updated = await tx.task.updateMany({
                where: {
                    id: existingTask.id,
                    ...(projectTargetChanged
                        ? {
                            projectId: existingTask.projectId,
                            timeLogs: {
                                none: {
                                    OR: [
                                        { endTime: null },
                                        { isPaused: true },
                                    ],
                                },
                            },
                        }
                        : {}),
                },
                data: updateData,
            })
            if (updated.count !== 1) {
                throw new ActionError(
                    "TASK_TARGET_LOCKED_BY_ACTIVE_TIMER",
                    "Stop the task timer before changing its project or target"
                )
            }
            if (projectTargetChanged) {
                await tx.timeLog.updateMany({
                    where: { taskId: existingTask.id },
                    data: { projectId: nextTarget.projectId },
                })
            }
            const task = await tx.task.findUniqueOrThrow({
                where: { id: existingTask.id },
                include: { project: { include: { site: true } } },
            })
            return { existingTask, task }
        }, { timeout: 15_000 })

        const { existingTask, task } = mutation
        const nextPriority = task.urgency
        const nextDeadline = task.deadline

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
            details: `taskId=${task.id}; projectId=${task.projectId || "none"}`,
        })
        revalidateTaskPaths(task.projectId || undefined, task.project?.site?.partnerId, task.project?.siteId)
        if (existingTask.projectId && existingTask.projectId !== task.projectId) {
            revalidateTaskPaths(
                existingTask.projectId,
                existingTask.project?.site?.partnerId,
                existingTask.project?.siteId
            )
        }

        return { success: true }
    } catch (error) {
        console.error("Update task failed:", error)
        return taskActionFailure(error, "Failed to update task")
    }
}

export async function deleteTask(taskId: string, projectId?: string | null) {
    try {
        const session = await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)
        const validatedProjectId = projectId ? ProjectIdSchema.parse(projectId) : undefined
        const task = await prisma.task.findFirst({
            where: { id: validatedTaskId },
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
            details: `taskId=${task.id}; projectId=${task.projectId || "none"}`,
        })
        revalidateTaskPaths(validatedProjectId || task.projectId || undefined, task.project?.site?.partnerId, task.project?.siteId)
        return { success: true }
    } catch (error) {
        console.error("Delete task failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete task") }
    }
}

export async function deleteTasks(taskIds: string[]) {
    try {
        const session = await requireAuth()
        const validatedTaskIds = TaskIdsSchema.parse(taskIds)
        if (validatedTaskIds.length === 0) return { success: true as const }
        const deleted = await prisma.task.deleteMany({
            where: { id: { in: validatedTaskIds } }
        })
        await logSessionAuditEvent(session, {
            action: "TASKS_BULK_DELETED",
            details: `requested=${validatedTaskIds.length}; deleted=${deleted.count}`,
        })
        revalidateTaskPaths()
        return { success: true as const }
    } catch (error) {
        console.error("Bulk delete tasks failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete tasks") }
    }
}

export async function updateTasksStatus(taskIds: string[], status: string) {
    try {
        const session = await requireAuth()
        const validatedTaskIds = TaskIdsSchema.parse(taskIds)
        const normalized = status === "Done" ? "Completed" : status
        const validatedStatus = TaskStatusSchema.parse(normalized)
        if (validatedTaskIds.length === 0) return { success: true as const }
        const uniqueTaskIds = Array.from(new Set(validatedTaskIds))

        const updated = await prisma.$transaction(async (tx) => {
            const tasks = await tx.task.findMany({
                where: { id: { in: uniqueTaskIds } },
                select: { id: true, projectId: true, taskScope: true },
            })
            if (tasks.length !== uniqueTaskIds.length) {
                throw new ActionError(
                    "TASK_SELECTION_STALE",
                    "One or more selected tasks no longer exist. Refresh and try again."
                )
            }
            if (tasks.some((task) => normalizeStoredTaskScope(task.taskScope, task.projectId) === "LMS")) {
                throw new ActionError(
                    "LMS_BULK_STATUS_NOT_SUPPORTED",
                    validatedStatus === "Completed"
                        ? "Complete LMS tasks individually so the project, task type, work date, and duration can be recorded"
                        : "Reopen LMS tasks individually so their LMS work-entry history is handled safely"
                )
            }

            const result = await tx.task.updateMany({
                where: { id: { in: uniqueTaskIds }, taskScope: { not: "LMS" } },
                data: { status: validatedStatus },
            })
            if (result.count !== uniqueTaskIds.length) {
                throw new ActionError(
                    "TASK_SELECTION_CHANGED",
                    "The selected tasks changed while the update was running. Refresh and try again."
                )
            }
            return result
        })
        await logSessionAuditEvent(session, {
            action: "TASKS_BULK_STATUS_UPDATED",
            details: `count=${updated.count}; status=${validatedStatus}`,
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath("/")
        return { success: true as const }
    } catch (error) {
        console.error("Bulk update tasks status failed:", error)
        return taskActionFailure(error, "Failed to update tasks")
    }
}

export async function getTaskLmsOptions() {
    try {
        await requireAuth()
        const [allocations, taskTypes, projectRows] = await Promise.all([
            prisma.lmsAllocation.findMany({
                select: { id: true, client: true },
                orderBy: { client: "asc" },
            }),
            prisma.lmsWorkTask.findMany({
                where: { isActive: true },
                select: { id: true, name: true, defaultDurationMinutes: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            }),
            prisma.project.findMany({
                select: {
                    id: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    site: { select: { domainName: true } },
                    services: { select: { serviceName: true, isRecurring: true } },
                },
                orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
            }),
        ])

        const projects = projectRows.map((project) => ({
            id: project.id,
            label: `${formatProjectName(project)}${project.status === "Active" ? "" : ` · ${project.status}`}`,
            status: project.status,
            createdAt: project.createdAt.toISOString(),
        }))

        return {
            success: true as const,
            data: { allocations, taskTypes, projects },
        }
    } catch (error) {
        console.error("Get task LMS options failed:", error)
        return taskActionFailure(error, "Failed to load LMS task options")
    }
}

export async function getTaskHistory(taskId: string) {
    try {
        await requireAuth()
        const validatedTaskId = TaskIdSchema.parse(taskId)

        const logs = await prisma.auditLog.findMany({
            where: {
                action: {
                    in: [
                        "TASK_CREATED",
                        "TASK_STATUS_CHANGED",
                        "TASK_PRIORITY_CHANGED",
                        "TASK_DEADLINE_CHANGED",
                        "TASK_TICKTICK_SYNCED",
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
