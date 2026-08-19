import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
    getTickTickAccessToken,
    getTickTickIntegrationRecord,
} from "./auth"
import {
    getTickTickProjectData,
    getTickTickTask,
    createTickTickTask,
    completeTickTickTask,
    TickTickApiError,
    type TickTickTask,
} from "./client"

const TICKTICK_PROVIDER = "ticktick"

export interface SyncResult {
    success: boolean
    importedCount: number
    completedInPixelistCount: number
    pushedToTickTickCount: number
    completedInTickTickCount: number
    error?: string
}

/**
 * Format task title and content for TickTick
 * e.g. Title: "[tacoloco.ro] - task name"
 * e.g. Content: "DEV, Mentenanță - August 2026\n\nTask details..."
 */
export function formatTickTickTaskPayload(task: {
    name: string
    description?: string | null
    taskScope?: string | null
    project?: {
        name?: string | null
        createdAt?: Date | string | null
        site?: { domainName?: string | null } | null
        services?: Array<{ serviceName: string; isRecurring?: boolean }> | null
    } | null
    lmsAllocation?: { client?: string | null } | null
    lmsTaskType?: { name?: string | null } | null
}): { title: string; content?: string } {
    let sitePrefix = ""
    let projectDetails = ""

    if (task.taskScope === "LMS" && task.lmsAllocation?.client) {
        sitePrefix = `[${task.lmsAllocation.client}]`
        if (task.lmsTaskType?.name) {
            projectDetails = `LMS: ${task.lmsTaskType.name}`
        }
    } else if (task.project) {
        const domain = (task.project.site?.domainName || task.project.name || "").trim()
        if (domain) {
            sitePrefix = `[${domain}]`
        }

        const serviceNames = (task.project.services || [])
            .map((s) => s.serviceName.trim())
            .filter(Boolean)
            .join(", ")

        const isRecurring = task.project.services?.some((s) => Boolean(s.isRecurring)) ?? false
        const createdDate = task.project.createdAt ? new Date(task.project.createdAt) : null
        const monthYear = createdDate && !Number.isNaN(createdDate.getTime())
            ? format(createdDate, "MMMM yyyy")
            : null

        const detailsParts: string[] = []
        if (serviceNames) {
            detailsParts.push(serviceNames)
        }
        if (isRecurring && monthYear) {
            detailsParts.push(monthYear)
        } else if (!serviceNames && monthYear) {
            detailsParts.push(monthYear)
        }

        if (detailsParts.length > 0) {
            projectDetails = detailsParts.join(" - ")
        }
    }

    const title = sitePrefix ? `${sitePrefix} - ${task.name}` : task.name

    const contentLines: string[] = []
    if (projectDetails) {
        contentLines.push(projectDetails)
    }
    if (task.description?.trim()) {
        contentLines.push(task.description.trim())
    }

    const content = contentLines.length > 0 ? contentLines.join("\n\n") : undefined

    return { title, content }
}

/**
 * Execute full bidirectional sync between Pixelist and TickTick
 */
export async function syncTickTick(options: { manual?: boolean } = {}): Promise<SyncResult> {
    const isManual = Boolean(options.manual)
    const integration = await getTickTickIntegrationRecord()
    if (!integration || !integration.enabled) {
        return {
            success: false,
            importedCount: 0,
            completedInPixelistCount: 0,
            pushedToTickTickCount: 0,
            completedInTickTickCount: 0,
            error: "TickTick integration is not connected or enabled",
        }
    }

    const externalProjectId = integration.externalProjectId
    if (!externalProjectId) {
        return {
            success: false,
            importedCount: 0,
            completedInPixelistCount: 0,
            pushedToTickTickCount: 0,
            completedInTickTickCount: 0,
            error: "No TickTick list is configured for synchronization",
        }
    }

    const token = await getTickTickAccessToken()
    if (!token) {
        await prisma.integration.update({
            where: { provider: TICKTICK_PROVIDER },
            data: {
                lastError: "Missing or invalid access token. Please reconnect TickTick.",
                lastSyncAt: new Date(),
            },
        })
        return {
            success: false,
            importedCount: 0,
            completedInPixelistCount: 0,
            pushedToTickTickCount: 0,
            completedInTickTickCount: 0,
            error: "Missing or invalid access token. Please reconnect TickTick.",
        }
    }

    let importedCount = 0
    let completedInPixelistCount = 0
    let pushedToTickTickCount = 0
    let completedInTickTickCount = 0

    try {
        // 1. Fetch all tasks from configured TickTick list
        const projectData = await getTickTickProjectData(token, externalProjectId)
        const tickTickTasks = projectData.tasks || []

        // 2. Load all existing mappings for TickTick
        const existingMappings = await prisma.taskIntegration.findMany({
            where: { provider: TICKTICK_PROVIDER },
            select: {
                id: true,
                taskId: true,
                externalTaskId: true,
                syncStatus: true,
                task: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        description: true,
                    },
                },
            },
        })

        const mappingByExternalId = new Map<string, (typeof existingMappings)[number]>()
        const mappingByTaskId = new Map<string, (typeof existingMappings)[number]>()

        for (const mapping of existingMappings) {
            mappingByExternalId.set(mapping.externalTaskId, mapping)
            mappingByTaskId.set(mapping.taskId, mapping)
        }

        const activeTickTaskMap = new Map<string, TickTickTask>()
        for (const t of tickTickTasks) {
            activeTickTaskMap.set(t.id, t)
        }

        // 3. Process TickTick Tasks -> Pixelist (New & In-List Status)
        for (const tickTask of tickTickTasks) {
            try {
                const existing = mappingByExternalId.get(tickTask.id)

                if (!existing) {
                    // Task exists in TickTick but NOT mapped in Pixelist -> Import into Pixelist
                    const isCompleted = tickTask.status === 2

                    // Smart project matching: check if title starts with [domain] - Task Name
                    let importedName = tickTask.title || "Untitled Task"
                    let linkedProjectId: string | null = null
                    let importedScope = "GENERAL"

                    const siteMatch = importedName.match(/^\[([^\]]+)\]\s*-\s*(.+)$/)
                    if (siteMatch) {
                        const domainOrName = siteMatch[1].trim()
                        importedName = siteMatch[2].trim()

                        const matchedProject = await prisma.project.findFirst({
                            where: {
                                status: "Active",
                                OR: [
                                    { site: { domainName: { equals: domainOrName } } },
                                    { name: { equals: domainOrName } },
                                ],
                            },
                            select: { id: true },
                            orderBy: { createdAt: "desc" },
                        })

                        if (matchedProject) {
                            linkedProjectId = matchedProject.id
                            importedScope = "FREELANCE"
                        }
                    }

                    await prisma.$transaction(async (tx) => {
                        const newTask = await tx.task.create({
                            data: {
                                name: importedName,
                                description: tickTask.content || null,
                                status: isCompleted ? "Completed" : "Active",
                                urgency: "Normal",
                                taskScope: importedScope,
                                projectId: linkedProjectId,
                            },
                        })

                        await tx.taskIntegration.create({
                            data: {
                                taskId: newTask.id,
                                provider: TICKTICK_PROVIDER,
                                externalTaskId: tickTask.id,
                                externalProjectId,
                                syncStatus: "synced",
                                lastSyncedAt: new Date(),
                            },
                        })

                        await tx.auditLog.create({
                            data: {
                                action: "TASK_CREATED",
                                success: true,
                                details: `taskId=${newTask.id}; status=${isCompleted ? "Completed" : "Active"}; source=TICKTICK`,
                            },
                        })
                    })

                    importedCount++
                    logger.info("[ticktick-sync] Imported new task from TickTick", {
                        externalTaskId: tickTask.id,
                        title: tickTask.title,
                        linkedProjectId,
                    })
                }
            } catch (err) {
                logger.error("[ticktick-sync] Failed to process TickTick task", {
                    externalTaskId: tickTask.id,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        }

        // 4. Check all mapped Pixelist tasks that are currently "Active" to see if completed in TickTick
        for (const mapping of existingMappings) {
            if (
                mapping.task &&
                mapping.task.status === "Active" &&
                mapping.externalTaskId &&
                !mapping.externalTaskId.startsWith("pending_")
            ) {
                const tickTask = activeTickTaskMap.get(mapping.externalTaskId)
                let isCompletedInTickTick = false

                if (tickTask) {
                    if (tickTask.status === 2 || tickTask.completedTime) {
                        isCompletedInTickTick = true
                    }
                } else {
                    // Task is missing from the active list in TickTick -> check single task endpoint
                    try {
                        const singleTask = await getTickTickTask(token, externalProjectId, mapping.externalTaskId)
                        if (!singleTask || singleTask.status === 2 || singleTask.completedTime) {
                            isCompletedInTickTick = true
                        }
                    } catch (err) {
                        logger.error("[ticktick-sync] Error checking single task status in TickTick", {
                            taskId: mapping.taskId,
                            externalTaskId: mapping.externalTaskId,
                            error: err instanceof Error ? err.message : String(err),
                        })
                    }
                }

                if (isCompletedInTickTick) {
                    await prisma.$transaction(async (tx) => {
                        await tx.task.update({
                            where: { id: mapping.taskId },
                            data: { status: "Completed" },
                        })

                        await tx.taskIntegration.update({
                            where: { id: mapping.id },
                            data: {
                                syncStatus: "synced",
                                lastSyncedAt: new Date(),
                            },
                        })

                        await tx.auditLog.create({
                            data: {
                                action: "TASK_STATUS_CHANGED",
                                success: true,
                                details: `taskId=${mapping.taskId}; from=Active; to=Completed; source=TICKTICK`,
                            },
                        })
                    })

                    completedInPixelistCount++
                    logger.info("[ticktick-sync] Marked Pixelist task completed from TickTick", {
                        taskId: mapping.taskId,
                        externalTaskId: mapping.externalTaskId,
                    })
                }
            }
        }

        // 5. Process Pixelist -> TickTick Pending Outbound Operations
        const pendingOutbound = await prisma.taskIntegration.findMany({
            where: {
                provider: TICKTICK_PROVIDER,
                syncStatus: { in: ["pending_create", "pending_complete"] },
            },
            include: {
                task: {
                    include: {
                        project: {
                            include: {
                                site: true,
                                services: true,
                            },
                        },
                        lmsAllocation: true,
                        lmsTaskType: true,
                    },
                },
            },
        })

        for (const item of pendingOutbound) {
            try {
                if (!item.task) continue

                if (item.syncStatus === "pending_create" || !item.externalTaskId) {
                    const payload = formatTickTickTaskPayload(item.task)
                    const created = await createTickTickTask(token, {
                        title: payload.title,
                        projectId: externalProjectId,
                        content: payload.content,
                    })

                    await prisma.$transaction(async (tx) => {
                        await tx.taskIntegration.update({
                            where: { id: item.id },
                            data: {
                                externalTaskId: created.id,
                                syncStatus: "synced",
                                syncError: null,
                                lastSyncedAt: new Date(),
                            },
                        })
                        await tx.auditLog.create({
                            data: {
                                action: "TASK_TICKTICK_SYNCED",
                                success: true,
                                details: `taskId=${item.taskId}; externalTaskId=${created.id}; to=Synced to TickTick; source=TICKTICK`,
                            },
                        })
                    })
                    pushedToTickTickCount++
                } else if (item.syncStatus === "pending_complete" && item.externalTaskId) {
                    await completeTickTickTask(token, externalProjectId, item.externalTaskId)

                    await prisma.$transaction(async (tx) => {
                        await tx.taskIntegration.update({
                            where: { id: item.id },
                            data: {
                                syncStatus: "synced",
                                syncError: null,
                                lastSyncedAt: new Date(),
                            },
                        })
                        await tx.auditLog.create({
                            data: {
                                action: "TASK_TICKTICK_SYNCED",
                                success: true,
                                details: `taskId=${item.taskId}; externalTaskId=${item.externalTaskId}; to=Completed in TickTick; source=TICKTICK`,
                            },
                        })
                    })
                    completedInTickTickCount++
                }
            } catch (err) {
                logger.error("[ticktick-sync] Outbound sync failed for task", {
                    taskId: item.taskId,
                    syncStatus: item.syncStatus,
                    error: err instanceof Error ? err.message : String(err),
                })
                await prisma.taskIntegration.update({
                    where: { id: item.id },
                    data: {
                        syncAttempts: { increment: 1 },
                        syncError: err instanceof Error ? err.message : "Sync error",
                    },
                })
            }
        }

        // 6. Check if any mapped completed Pixelist tasks need to be completed in TickTick
        const openInTickTickButDoneInPixelist = await prisma.taskIntegration.findMany({
            where: {
                provider: TICKTICK_PROVIDER,
                syncStatus: "synced",
                task: { status: "Completed" },
            },
            select: {
                id: true,
                externalTaskId: true,
                taskId: true,
            },
        })

        for (const item of openInTickTickButDoneInPixelist) {
            if (activeTickTaskMap.has(item.externalTaskId)) {
                try {
                    await completeTickTickTask(token, externalProjectId, item.externalTaskId)
                    await prisma.$transaction(async (tx) => {
                        await tx.taskIntegration.update({
                            where: { id: item.id },
                            data: {
                                syncStatus: "synced",
                                lastSyncedAt: new Date(),
                            },
                        })
                        await tx.auditLog.create({
                            data: {
                                action: "TASK_TICKTICK_SYNCED",
                                success: true,
                                details: `taskId=${item.taskId}; externalTaskId=${item.externalTaskId}; to=Completed in TickTick; source=TICKTICK`,
                            },
                        })
                    })
                    completedInTickTickCount++
                    logger.info("[ticktick-sync] Marked TickTick task completed from Pixelist", {
                        taskId: item.taskId,
                        externalTaskId: item.externalTaskId,
                    })
                } catch (err) {
                    logger.error("[ticktick-sync] Failed to complete task in TickTick", {
                        taskId: item.taskId,
                        externalTaskId: item.externalTaskId,
                        error: err instanceof Error ? err.message : String(err),
                    })
                }
            }
        }

        // Update integration record with success
        await prisma.integration.update({
            where: { provider: TICKTICK_PROVIDER },
            data: {
                lastSyncAt: new Date(),
                lastSuccessfulSyncAt: new Date(),
                lastError: null,
            },
        })

        logger.info("[ticktick-sync] Sync completed successfully", {
            manual: isManual,
            importedCount,
            completedInPixelistCount,
            pushedToTickTickCount,
            completedInTickTickCount,
        })

        return {
            success: true,
            importedCount,
            completedInPixelistCount,
            pushedToTickTickCount,
            completedInTickTickCount,
        }
    } catch (error) {
        const isAuthErr = error instanceof TickTickApiError && error.isAuthError
        const errorMessage = error instanceof Error ? error.message : "Synchronization failed"

        logger.error("[ticktick-sync] Sync failed with error", {
            error: errorMessage,
            isAuthError: isAuthErr,
        })

        await prisma.integration.update({
            where: { provider: TICKTICK_PROVIDER },
            data: {
                lastSyncAt: new Date(),
                lastError: isAuthErr ? "Needs reconnect: Authorization expired" : errorMessage,
            },
        })

        return {
            success: false,
            importedCount,
            completedInPixelistCount,
            pushedToTickTickCount,
            completedInTickTickCount,
            error: errorMessage,
        }
    }
}

/**
 * Non-blocking outbound push when a task is created in Pixelist
 */
export async function syncOutboundTaskCreate(taskId: string): Promise<void> {
    try {
        const integration = await getTickTickIntegrationRecord()
        if (!integration || !integration.enabled || !integration.externalProjectId) {
            return
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                taskIntegrations: true,
                project: {
                    include: {
                        site: true,
                        services: true,
                    },
                },
                lmsAllocation: true,
                lmsTaskType: true,
            },
        })
        if (!task) return

        const existingMapping = task.taskIntegrations.find((ti) => ti.provider === TICKTICK_PROVIDER)
        if (existingMapping && existingMapping.externalTaskId && !existingMapping.externalTaskId.startsWith("pending_")) {
            return
        }

        const token = await getTickTickAccessToken()
        if (!token) {
            // Record pending sync
            await prisma.taskIntegration.upsert({
                where: {
                    provider_taskId: {
                        provider: TICKTICK_PROVIDER,
                        taskId: task.id,
                    },
                },
                create: {
                    taskId: task.id,
                    provider: TICKTICK_PROVIDER,
                    externalTaskId: `pending_${task.id}`,
                    externalProjectId: integration.externalProjectId,
                    syncStatus: "pending_create",
                },
                update: {
                    syncStatus: "pending_create",
                },
            })
            return
        }

        try {
            const payload = formatTickTickTaskPayload(task)
            const created = await createTickTickTask(token, {
                title: payload.title,
                projectId: integration.externalProjectId,
                content: payload.content,
            })

            await prisma.$transaction(async (tx) => {
                await tx.taskIntegration.upsert({
                    where: {
                        provider_taskId: {
                            provider: TICKTICK_PROVIDER,
                            taskId: task.id,
                        },
                    },
                    create: {
                        taskId: task.id,
                        provider: TICKTICK_PROVIDER,
                        externalTaskId: created.id,
                        externalProjectId: integration.externalProjectId,
                        syncStatus: "synced",
                        lastSyncedAt: new Date(),
                    },
                    update: {
                        externalTaskId: created.id,
                        externalProjectId: integration.externalProjectId,
                        syncStatus: "synced",
                        lastSyncedAt: new Date(),
                    },
                })

                await tx.auditLog.create({
                    data: {
                        action: "TASK_TICKTICK_SYNCED",
                        success: true,
                        details: `taskId=${task.id}; externalTaskId=${created.id}; to=Synced to TickTick; source=TICKTICK`,
                    },
                })
            })

            logger.info("[ticktick-sync] Immediate outbound task created in TickTick", {
                taskId: task.id,
                externalTaskId: created.id,
                title: payload.title,
            })
        } catch (apiError) {
            logger.error("[ticktick-sync] Immediate outbound task creation failed", {
                taskId: task.id,
                error: apiError instanceof Error ? apiError.message : String(apiError),
            })
            await prisma.taskIntegration.upsert({
                where: {
                    provider_taskId: {
                        provider: TICKTICK_PROVIDER,
                        taskId: task.id,
                    },
                },
                create: {
                    taskId: task.id,
                    provider: TICKTICK_PROVIDER,
                    externalTaskId: `pending_${task.id}`,
                    externalProjectId: integration.externalProjectId,
                    syncStatus: "pending_create",
                    syncError: apiError instanceof Error ? apiError.message : "API error",
                },
                update: {
                    syncStatus: "pending_create",
                    syncError: apiError instanceof Error ? apiError.message : "API error",
                },
            })
        }
    } catch (err) {
        logger.error("[ticktick-sync] Unexpected error in syncOutboundTaskCreate", {
            taskId,
            error: err,
        })
    }
}

/**
 * Non-blocking outbound completion push when a task is completed in Pixelist
 */
export async function syncOutboundTaskComplete(taskId: string): Promise<void> {
    try {
        const integration = await getTickTickIntegrationRecord()
        if (!integration || !integration.enabled || !integration.externalProjectId) {
            return
        }

        const mapping = await prisma.taskIntegration.findUnique({
            where: {
                provider_taskId: {
                    provider: TICKTICK_PROVIDER,
                    taskId,
                },
            },
        })

        if (!mapping || !mapping.externalTaskId || mapping.externalTaskId.startsWith("pending_")) {
            return
        }

        const token = await getTickTickAccessToken()
        if (!token) {
            await prisma.taskIntegration.update({
                where: { id: mapping.id },
                data: { syncStatus: "pending_complete" },
            })
            return
        }

        try {
            await completeTickTickTask(token, integration.externalProjectId, mapping.externalTaskId)
            await prisma.$transaction(async (tx) => {
                await tx.taskIntegration.update({
                    where: { id: mapping.id },
                    data: {
                        syncStatus: "synced",
                        lastSyncedAt: new Date(),
                        syncError: null,
                    },
                })
                await tx.auditLog.create({
                    data: {
                        action: "TASK_TICKTICK_SYNCED",
                        success: true,
                        details: `taskId=${taskId}; externalTaskId=${mapping.externalTaskId}; to=Completed in TickTick; source=TICKTICK`,
                    },
                })
            })
            logger.info("[ticktick-sync] Immediate outbound task completed in TickTick", {
                taskId,
                externalTaskId: mapping.externalTaskId,
            })
        } catch (apiError) {
            logger.error("[ticktick-sync] Immediate outbound completion failed", {
                taskId,
                error: apiError instanceof Error ? apiError.message : String(apiError),
            })
            await prisma.taskIntegration.update({
                where: { id: mapping.id },
                data: {
                    syncStatus: "pending_complete",
                    syncError: apiError instanceof Error ? apiError.message : "API error",
                },
            })
        }
    } catch (err) {
        logger.error("[ticktick-sync] Unexpected error in syncOutboundTaskComplete", {
            taskId,
            error: err,
        })
    }
}

/**
 * Export / push all unmapped active tasks from Pixelist into TickTick
 */
export async function pushAllActiveTasksToTickTick(): Promise<{ success: boolean; pushedCount: number; error?: string }> {
    const integration = await getTickTickIntegrationRecord()
    if (!integration || !integration.enabled || !integration.externalProjectId) {
        return { success: false, pushedCount: 0, error: "TickTick not connected or no list selected" }
    }

    const token = await getTickTickAccessToken()
    if (!token) {
        return { success: false, pushedCount: 0, error: "Missing TickTick access token" }
    }

    const existingMappings = await prisma.taskIntegration.findMany({
        where: { provider: TICKTICK_PROVIDER },
        select: { taskId: true },
    })
    const mappedTaskIds = new Set(existingMappings.map((m) => m.taskId))

    const activeTasks = await prisma.task.findMany({
        where: {
            status: "Active",
            id: { notIn: Array.from(mappedTaskIds) },
        },
        include: {
            project: {
                include: {
                    site: true,
                    services: true,
                },
            },
            lmsAllocation: true,
            lmsTaskType: true,
        },
        orderBy: { createdAt: "asc" },
    })

    let pushedCount = 0
    for (const task of activeTasks) {
        try {
            const payload = formatTickTickTaskPayload(task)
            const created = await createTickTickTask(token, {
                title: payload.title,
                projectId: integration.externalProjectId,
                content: payload.content,
            })

            await prisma.$transaction(async (tx) => {
                await tx.taskIntegration.create({
                    data: {
                        taskId: task.id,
                        provider: TICKTICK_PROVIDER,
                        externalTaskId: created.id,
                        externalProjectId: integration.externalProjectId,
                        syncStatus: "synced",
                        lastSyncedAt: new Date(),
                    },
                })
                await tx.auditLog.create({
                    data: {
                        action: "TASK_TICKTICK_SYNCED",
                        success: true,
                        details: `taskId=${task.id}; externalTaskId=${created.id}; to=Synced to TickTick; source=TICKTICK`,
                    },
                })
            })
            pushedCount++
        } catch (err) {
            logger.error("[ticktick-sync] Failed to push existing task to TickTick", { taskId: task.id, error: err })
        }
    }

    return { success: true, pushedCount }
}
