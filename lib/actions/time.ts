"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { z } from "zod"

function revalidateTimePaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/time")
    revalidatePath("/tasks")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) {
        revalidatePath(`/partners/${sitePartnerId}/${siteId}`)
        revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
    }
}

const TimeLogFiltersSchema = z.object({
    projectId: z.string().uuid().optional().or(z.literal("all")),
    partnerId: z.string().uuid().optional().or(z.literal("all")),
    q: z.string().trim().max(200).optional(),
    take: z.number().int().min(1).max(200).optional(),
    skip: z.number().int().min(0).optional(),
}).optional()

const TimeLogIdSchema = z.string().uuid()
const TimeLogIdsSchema = z.array(TimeLogIdSchema).max(1000)
const ProjectIdSchema = z.string().uuid()
const TaskIdSchema = z.string().uuid()
const OptionalTimeLogIdSchema = z.string().uuid().optional()

const LogTimeInputSchema = z.object({
    projectId: ProjectIdSchema,
    taskId: TaskIdSchema.optional(),
    description: z.string().max(2000).optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    durationSeconds: z.number().int().min(0).max(86400 * 365).optional(),
})

const UpdateTimeLogInputSchema = z.object({
    projectId: ProjectIdSchema.optional(),
    taskId: TaskIdSchema.nullable().optional(),
    description: z.string().max(2000).optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    durationSeconds: z.number().int().min(0).max(86400 * 365).optional(),
    source: z.enum(["MANUAL", "TIMER"]).optional(),
})

export async function logTime(data: {
    projectId: string
    taskId?: string
    description?: string
    startTime?: Date
    endTime?: Date
    durationSeconds?: number
}) {
    try {
        const session = await requireAuth()
        const validated = LogTimeInputSchema.parse(data)
        const project = await prisma.project.findFirst({
            where: { id: validated.projectId },
            select: { id: true },
        })
        if (!project) {
            await logSessionAuditEvent(session, {
                action: "TIME_LOG_CREATE_FAILED",
                success: false,
                details: `projectId=${validated.projectId}; reason=project_not_found`,
            })
            return { success: false, error: "Project not found" }
        }
        if (validated.taskId) {
            const task = await prisma.task.findFirst({
                where: { id: validated.taskId, projectId: validated.projectId },
                select: { id: true },
            })
            if (!task) {
                await logSessionAuditEvent(session, {
                    action: "TIME_LOG_CREATE_FAILED",
                    success: false,
                    details: `projectId=${validated.projectId}; taskId=${validated.taskId}; reason=task_not_found`,
                })
                return { success: false, error: "Task not found for this project" }
            }
        }
        const log = await prisma.timeLog.create({
            data: {
                projectId: validated.projectId,
                taskId: validated.taskId,
                description: validated.description,
                startTime: validated.startTime || new Date(),
                endTime: validated.endTime,
                durationSeconds: validated.durationSeconds,
            },
            include: { project: { include: { site: true } } }
        })
        await logSessionAuditEvent(session, {
            action: "TIME_LOG_CREATED",
            details: `timeLogId=${log.id}; projectId=${validated.projectId}`,
        })
        revalidateTimePaths(validated.projectId, log.project.site.partnerId, log.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Log time failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to log time") }
    }
}

export async function getTimeLogs(filters?: { projectId?: string, partnerId?: string, q?: string, take?: number, skip?: number }) {
    try {
        await requireAuth()
        const validatedFilters = TimeLogFiltersSchema.parse(filters)
        const where: Prisma.TimeLogWhereInput = {}

        if (validatedFilters?.q) {
            where.description = { contains: validatedFilters.q }
        }

        if (validatedFilters?.projectId && validatedFilters.projectId !== "all") {
            where.projectId = validatedFilters.projectId
        } else if (validatedFilters?.partnerId && validatedFilters.partnerId !== "all") {
            where.project = {
                site: { partnerId: validatedFilters.partnerId }
            }
        }

        const [logs, total] = await Promise.all([
            prisma.timeLog.findMany({
                where,
                include: {
                    project: {
                        include: {
                            site: {
                                select: {
                                    domainName: true
                                }
                            },
                            services: {
                                select: {
                                    serviceName: true,
                                    isRecurring: true
                                }
                            }
                        }
                    },
                    task: true
                },
                orderBy: {
                    startTime: 'desc'
                },
                take: validatedFilters?.take || 100,
                skip: validatedFilters?.skip || 0
            }),
            prisma.timeLog.count({ where }),
        ])
        return { success: true, data: logs, total }
    } catch (error) {
        console.error("Get time logs failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to fetch time logs"), total: 0 }
    }
}

export async function updateTimeLog(logId: string, data: {
    projectId?: string
    taskId?: string | null
    description?: string
    startTime?: Date
    endTime?: Date
    durationSeconds?: number
    source?: "MANUAL" | "TIMER"
}) {
    try {
        const session = await requireAuth()
        const validatedLogId = TimeLogIdSchema.parse(logId)
        const validatedData = UpdateTimeLogInputSchema.parse(data)
        const existingLog = await prisma.timeLog.findFirst({
            where: { id: validatedLogId },
            select: { id: true },
        })
        if (!existingLog) {
            await logSessionAuditEvent(session, {
                action: "TIME_LOG_UPDATE_FAILED",
                success: false,
                details: `timeLogId=${validatedLogId}; reason=not_found`,
            })
            return { success: false, error: "Time log not found" }
        }
        if (validatedData.projectId) {
            const project = await prisma.project.findFirst({
                where: { id: validatedData.projectId },
                select: { id: true },
            })
            if (!project) {
                await logSessionAuditEvent(session, {
                    action: "TIME_LOG_UPDATE_FAILED",
                    success: false,
                    details: `timeLogId=${validatedLogId}; projectId=${validatedData.projectId}; reason=project_not_found`,
                })
                return { success: false, error: "Project not found" }
            }
        }
        if (validatedData.taskId) {
            const task = await prisma.task.findFirst({
                where: { id: validatedData.taskId },
                select: { id: true },
            })
            if (!task) {
                await logSessionAuditEvent(session, {
                    action: "TIME_LOG_UPDATE_FAILED",
                    success: false,
                    details: `timeLogId=${validatedLogId}; taskId=${validatedData.taskId}; reason=task_not_found`,
                })
                return { success: false, error: "Task not found" }
            }
        }
        const log = await prisma.timeLog.update({
            where: { id: existingLog.id },
            data: {
                projectId: validatedData.projectId,
                taskId: validatedData.taskId,
                description: validatedData.description,
                startTime: validatedData.startTime,
                endTime: validatedData.endTime,
                durationSeconds: validatedData.durationSeconds,
                source: validatedData.source,
            },
            include: { project: { include: { site: true } } }
        })
        await logSessionAuditEvent(session, {
            action: "TIME_LOG_UPDATED",
            details: `timeLogId=${log.id}; projectId=${log.projectId}`,
        })
        revalidatePath("/time")
        revalidatePath(`/projects/${log.projectId}`)
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Update time log failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to update time log") }
    }
}

export async function deleteTimeLog(logId: string) {
    try {
        const session = await requireAuth()
        const validatedLogId = TimeLogIdSchema.parse(logId)
        const log = await prisma.timeLog.findFirst({
            where: { id: validatedLogId },
            select: { id: true, projectId: true },
        })
        if (!log) {
            await logSessionAuditEvent(session, {
                action: "TIME_LOG_DELETE_FAILED",
                success: false,
                details: `timeLogId=${validatedLogId}; reason=not_found`,
            })
            return { success: false, error: "Time log not found" }
        }
        await prisma.timeLog.delete({ where: { id: log.id } })
        await logSessionAuditEvent(session, {
            action: "TIME_LOG_DELETED",
            details: `timeLogId=${log.id}; projectId=${log.projectId}`,
        })
        revalidatePath("/time")
        revalidatePath(`/projects/${log.projectId}`)
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Delete time log failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete time log") }
    }
}

export async function deleteTimeLogs(logIds: string[]) {
    try {
        const session = await requireAuth()
        const validatedLogIds = TimeLogIdsSchema.parse(logIds)
        if (validatedLogIds.length === 0) {
            return { success: true }
        }
        const deleted = await prisma.timeLog.deleteMany({
            where: {
                id: { in: validatedLogIds },
            }
        })
        await logSessionAuditEvent(session, {
            action: "TIME_LOGS_BULK_DELETED",
            details: `requested=${validatedLogIds.length}; deleted=${deleted.count}`,
        })
        revalidatePath("/time")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk delete time logs failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete time logs") }
    }
}

export async function startTimer(projectId: string, taskId?: string, description?: string) {
    try {
        const session = await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const validatedTaskId = taskId ? TaskIdSchema.parse(taskId) : undefined
        const validatedDescription = description ? z.string().max(2000).parse(description) : undefined
        const log = await prisma.$transaction(async (tx) => {
            const project = await tx.project.findUnique({
                where: { id: validatedProjectId },
                select: { id: true },
            })
            if (!project) {
                throw new ActionError("PROJECT_NOT_FOUND", "Project not found")
            }
            if (validatedTaskId) {
                const task = await tx.task.findUnique({
                    where: { id: validatedTaskId },
                    select: { id: true, projectId: true, taskScope: true },
                })
                if (!task || task.projectId !== validatedProjectId || task.taskScope !== "FREELANCE") {
                    throw new ActionError(
                        "TASK_PROJECT_MISMATCH",
                        "Task not found for this freelance project"
                    )
                }
            }

            const activeTimer = await tx.timeLog.findFirst({
                where: { endTime: null },
            })
            if (activeTimer) {
                const endTime = new Date()
                const durationSeconds = Math.max(
                    0,
                    Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000)
                )
                await tx.timeLog.update({
                    where: { id: activeTimer.id },
                    data: { endTime, durationSeconds },
                })
            }

            await tx.timeLog.updateMany({
                where: { isPaused: true },
                data: { isPaused: false },
            })

            if (validatedTaskId) {
                const stillAttached = await tx.task.findFirst({
                    where: {
                        id: validatedTaskId,
                        projectId: validatedProjectId,
                        taskScope: "FREELANCE",
                    },
                    select: { id: true },
                })
                if (!stillAttached) {
                    throw new ActionError(
                        "TASK_TARGET_CHANGED",
                        "The task target changed before the timer could start"
                    )
                }
            }

            return tx.timeLog.create({
                data: {
                    projectId: validatedProjectId,
                    taskId: validatedTaskId,
                    description: validatedDescription,
                    startTime: new Date(),
                    endTime: null,
                    durationSeconds: null,
                    source: "TIMER",
                },
                include: { project: { include: { site: true } } },
            })
        })

        await logSessionAuditEvent(session, {
            action: "TIME_TIMER_STARTED",
            details: `timeLogId=${log.id}; projectId=${validatedProjectId}`,
        })
        revalidateTimePaths(validatedProjectId)
        return { success: true as const, data: log }
    } catch (error) {
        console.error("Start timer failed:", error)
        return {
            success: false as const,
            error: getActionErrorMessage(error, "Failed to start timer"),
            ...(error instanceof ActionError ? { code: error.code } : {}),
        }
    }
}

export async function stopTimer(timerId?: string) {
    try {
        const session = await requireAuth()
        const validatedTimerId = OptionalTimeLogIdSchema.parse(timerId)
        const baseTimerWhere = {}
        const activeTimer = validatedTimerId
            ? await prisma.timeLog.findFirst({
                where: {
                    ...baseTimerWhere,
                    id: validatedTimerId,
                    endTime: null,
                }
            })
            : await prisma.timeLog.findFirst({
                where: { ...baseTimerWhere, endTime: null }
            })

        if (activeTimer) {
            const endTime = new Date()
            const durationSeconds = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000)

            await prisma.timeLog.update({
                where: { id: activeTimer.id },
                data: {
                    endTime,
                    durationSeconds
                }
            })
            await logSessionAuditEvent(session, {
                action: "TIME_TIMER_STOPPED",
                details: `timeLogId=${activeTimer.id}; mode=running`,
            })
        } else {
            const pausedTimer = validatedTimerId
                ? await prisma.timeLog.findFirst({
                    where: {
                        ...baseTimerWhere,
                        id: validatedTimerId,
                        isPaused: true,
                    },
                    orderBy: { endTime: "desc" }
                })
                : await prisma.timeLog.findFirst({
                    where: { ...baseTimerWhere, isPaused: true },
                    orderBy: { endTime: "desc" }
                })

            if (pausedTimer) {
                await prisma.timeLog.update({
                    where: { id: pausedTimer.id },
                    data: { isPaused: false }
                })
                await logSessionAuditEvent(session, {
                    action: "TIME_TIMER_STOPPED",
                    details: `timeLogId=${pausedTimer.id}; mode=paused`,
                })
            } else {
                await logSessionAuditEvent(session, {
                    action: "TIME_TIMER_STOP_FAILED",
                    success: false,
                    details: "reason=no_active_or_paused_timer",
                })
                return { success: false, error: "No active or paused timer found" }
            }
        }

        revalidateTimePaths()
        return { success: true, data: { id: activeTimer?.id ?? validatedTimerId ?? null } }
    } catch (error) {
        console.error("Stop timer failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to stop timer") }
    }
}

export async function pauseTimer(timerId?: string) {
    try {
        const session = await requireAuth()
        const validatedTimerId = OptionalTimeLogIdSchema.parse(timerId)
        const activeTimer = validatedTimerId
            ? await prisma.timeLog.findFirst({
                where: {
                    id: validatedTimerId,
                    endTime: null,
                }
            })
            : await prisma.timeLog.findFirst({
                where: {
                    endTime: null,
                }
            })

        if (!activeTimer) {
            await logSessionAuditEvent(session, {
                action: "TIME_TIMER_PAUSE_FAILED",
                success: false,
                details: "reason=no_active_timer",
            })
            return { success: false, error: "No active timer found" }
        }

        const endTime = new Date()
        const durationSeconds = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000)

        const pausedLog = await prisma.timeLog.update({
            where: { id: activeTimer.id },
            data: {
                endTime,
                durationSeconds,
                isPaused: true
            }
        })

        await logSessionAuditEvent(session, {
            action: "TIME_TIMER_PAUSED",
            details: `timeLogId=${activeTimer.id}`,
        })
        revalidateTimePaths()
        return { success: true, data: pausedLog }
    } catch (error) {
        console.error("Pause timer failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to pause timer") }
    }
}

export async function resumeTimer(timerId?: string) {
    try {
        const session = await requireAuth()
        const validatedTimerId = OptionalTimeLogIdSchema.parse(timerId)
        const pausedTimer = validatedTimerId
            ? await prisma.timeLog.findFirst({
                where: {
                    id: validatedTimerId,
                    isPaused: true,
                },
                orderBy: { endTime: "desc" }
            })
            : await prisma.timeLog.findFirst({
                where: {
                    isPaused: true,
                },
                orderBy: { endTime: "desc" }
            })

        if (!pausedTimer) {
            await logSessionAuditEvent(session, {
                action: "TIME_TIMER_RESUME_FAILED",
                success: false,
                details: "reason=no_paused_timer",
            })
            return { success: false, error: "No paused timer found" }
        }

        const adjustedStartTime = new Date(Date.now() - ((pausedTimer.durationSeconds || 0) * 1000));

        const log = await prisma.timeLog.update({
            where: { id: pausedTimer.id },
            data: {
                startTime: adjustedStartTime,
                endTime: null,
                durationSeconds: null,
                isPaused: false
            },
            include: { project: { include: { site: true } } }
        })

        await logSessionAuditEvent(session, {
            action: "TIME_TIMER_RESUMED",
            details: `timeLogId=${log.id}; projectId=${log.projectId}`,
        })
        revalidateTimePaths()
        return { success: true, data: log }
    } catch (error) {
        console.error("Resume timer failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to resume timer") }
    }
}

export async function getActiveTimer() {
    try {
        await requireAuth()
        const activeTimer = await prisma.timeLog.findFirst({
            where: {
                endTime: null,
            },
            include: {
                task: true,
                project: {
                    include: {
                        site: true,
                        services: {
                            select: {
                                serviceName: true,
                                isRecurring: true,
                            }
                        }
                    }
                }
            }
        })

        if (activeTimer) {
            return { success: true, data: activeTimer, status: "running" }
        }

        const pausedTimer = await prisma.timeLog.findFirst({
            where: {
                isPaused: true,
            },
            orderBy: { endTime: "desc" },
            include: {
                task: true,
                project: {
                    include: {
                        site: true,
                        services: {
                            select: {
                                serviceName: true,
                                isRecurring: true,
                            }
                        }
                    }
                }
            }
        })

        if (pausedTimer) {
            return { success: true, data: pausedTimer, status: "paused" }
        }

        return { success: true, data: null, status: "idle" }
    } catch {
        return { success: false, error: "Failed to fetch active timer" }
    }
}
