"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"

function revalidateTimePaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/time")
    revalidatePath("/tasks")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
}

export async function logTime(data: {
    projectId: string
    taskId?: string
    description?: string
    startTime?: Date
    endTime?: Date
    durationSeconds?: number
}) {
    try {
        await requireAuth()
        const log = await prisma.timeLog.create({
            data: {
                projectId: data.projectId,
                taskId: data.taskId,
                description: data.description,
                startTime: data.startTime || new Date(),
                endTime: data.endTime,
                durationSeconds: data.durationSeconds,
            },
            include: { project: { include: { site: true } } }
        })
        revalidateTimePaths(data.projectId, log.project.site.partnerId, log.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Log time failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to log time" }
    }
}

export async function getTimeLogs(filters?: { projectId?: string, partnerId?: string, q?: string, take?: number, skip?: number }) {
    try {
        const where: Prisma.TimeLogWhereInput = {}

        if (filters?.q) {
            where.description = { contains: filters.q }
        }

        if (filters?.projectId && filters.projectId !== "all") {
            where.projectId = filters.projectId
        } else if (filters?.partnerId && filters.partnerId !== "all") {
            where.project = {
                site: { partnerId: filters.partnerId }
            }
        }

        const logs = await prisma.timeLog.findMany({
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
            take: filters?.take || 100,
            skip: filters?.skip || 0
        })
        return { success: true, data: logs }
    } catch (error) {
        console.error("Get time logs failed:", error)
        return { success: false, error: "Failed to fetch time logs" }
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
        await requireAuth()
        const log = await prisma.timeLog.update({
            where: { id: logId },
            data: {
                projectId: data.projectId,
                taskId: data.taskId,
                description: data.description,
                startTime: data.startTime,
                endTime: data.endTime,
                durationSeconds: data.durationSeconds,
            },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/time")
        revalidatePath(`/projects/${log.projectId}`)
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Update time log failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update time log" }
    }
}

export async function deleteTimeLog(logId: string) {
    try {
        await requireAuth()
        const log = await prisma.timeLog.delete({
            where: { id: logId }
        })
        revalidatePath("/time")
        revalidatePath(`/projects/${log.projectId}`)
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Delete time log failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete time log" }
    }
}

export async function deleteTimeLogs(logIds: string[]) {
    try {
        await requireAuth()
        await prisma.timeLog.deleteMany({
            where: {
                id: { in: logIds }
            }
        })
        revalidatePath("/time")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk delete time logs failed:", error)
        return { success: false, error: "Failed to delete time logs" }
    }
}

export async function startTimer(projectId: string, taskId?: string, description?: string) {
    try {
        await requireAuth()
        const activeTimer = await prisma.timeLog.findFirst({
            where: { endTime: null }
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
        }

        await prisma.timeLog.updateMany({
            where: { isPaused: true },
            data: { isPaused: false }
        })

        const log = await prisma.timeLog.create({
            data: {
                projectId,
                taskId,
                description,
                startTime: new Date(),
                endTime: null,
                durationSeconds: null
            },
            include: { project: { include: { site: true } } }
        })

        revalidateTimePaths(projectId)
        return { success: true, data: log }
    } catch (error) {
        console.error("Start timer failed:", error)
        return { success: false, error: "Failed to start timer" }
    }
}

export async function stopTimer() {
    try {
        await requireAuth()
        const activeTimer = await prisma.timeLog.findFirst({
            where: { endTime: null }
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
        } else {
            const pausedTimer = await prisma.timeLog.findFirst({
                where: { isPaused: true },
                orderBy: { endTime: "desc" }
            })

            if (pausedTimer) {
                await prisma.timeLog.update({
                    where: { id: pausedTimer.id },
                    data: { isPaused: false }
                })
            } else {
                return { success: false, error: "No active or paused timer found" }
            }
        }

        revalidateTimePaths()
        return { success: true }
    } catch (error) {
        console.error("Stop timer failed:", error)
        return { success: false, error: "Failed to stop timer" }
    }
}

export async function pauseTimer() {
    try {
        await requireAuth()
        const activeTimer = await prisma.timeLog.findFirst({
            where: { endTime: null }
        })

        if (!activeTimer) {
            return { success: false, error: "No active timer found" }
        }

        const endTime = new Date()
        const durationSeconds = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000)

        await prisma.timeLog.update({
            where: { id: activeTimer.id },
            data: {
                endTime,
                durationSeconds,
                isPaused: true
            }
        })

        revalidateTimePaths()
        return { success: true }
    } catch (error) {
        console.error("Pause timer failed:", error)
        return { success: false, error: "Failed to pause timer" }
    }
}

export async function resumeTimer() {
    try {
        const pausedTimer = await prisma.timeLog.findFirst({
            where: { isPaused: true },
            orderBy: { endTime: "desc" }
        })

        if (!pausedTimer) {
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

        revalidateTimePaths()
        return { success: true, data: log }
    } catch (error) {
        console.error("Resume timer failed:", error)
        return { success: false, error: "Failed to resume timer" }
    }
}

export async function getActiveTimer() {
    try {
        const activeTimer = await prisma.timeLog.findFirst({
            where: { endTime: null },
            include: {
                task: true,
                project: {
                    include: {
                        site: true
                    }
                }
            }
        })

        if (activeTimer) {
            return { success: true, data: activeTimer, status: "running" }
        }

        const pausedTimer = await prisma.timeLog.findFirst({
            where: { isPaused: true },
            orderBy: { endTime: "desc" },
            include: {
                task: true,
                project: {
                    include: {
                        site: true
                    }
                }
            }
        })

        if (pausedTimer) {
            return { success: true, data: pausedTimer, status: "paused" }
        }

        return { success: true, data: null, status: "idle" }
    } catch (error) {
        return { success: false, error: "Failed to fetch active timer" }
    }
}
