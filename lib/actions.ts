"use server"

import { revalidatePath } from "next/cache"
// Force reload after schema update
import prisma from "@/lib/prisma"
import { z } from "zod"

// Zod Schemas
const CreateProjectSchema = z.object({
    siteId: z.string().uuid(),
    serviceIds: z.array(z.string().uuid()).min(1, "At least one service must be selected"),
    name: z.string().optional(),
    currentFee: z.number().optional().nullable(),
    status: z.enum(["Active", "Paused", "Completed"]).optional(),
    paymentStatus: z.enum(["Paid", "Unpaid"]).optional(),
})

const UpdateProjectSchema = z.object({
    name: z.string().nullable().optional(),
    status: z.enum(["Active", "Paused", "Completed"]).optional(),
    paymentStatus: z.enum(["Paid", "Unpaid"]).optional(),
    paidAt: z.union([z.date(), z.string(), z.null()]).optional(),
    currentFee: z.number().nullable().optional(),
    serviceIds: z.array(z.string().uuid()).optional(),
})

// Previous functions...
export async function createPartner(data: {
    name: string
    isMainJob: boolean
    internalNotes?: string
}) {
    await prisma.partner.create({
        data: {
            name: data.name,
            isMainJob: data.isMainJob,
            internalNotes: data.internalNotes,
        },
    })
    revalidatePath("/vault")
}

export async function updatePartner(partnerId: string, data: {
    name: string
    businessName?: string
    isMainJob: boolean
    emailPrimary?: string
    emailSecondary?: string
    phone?: string
    internalNotes?: string
}) {
    await prisma.partner.update({
        where: { id: partnerId },
        data,
    })
    revalidatePath("/vault")
    revalidatePath(`/vault/${partnerId}`)
}

export async function deletePartner(partnerId: string) {
    await prisma.partner.delete({
        where: { id: partnerId },
    })
    revalidatePath("/vault")
}

export async function createSite(partnerId: string, domainName: string) {
    const site = await prisma.site.create({
        data: {
            partnerId,
            domainName,
        }
    })
    revalidatePath(`/vault/${partnerId}`)
    revalidatePath("/vault/sites")
    return site
}

export async function updateSiteDetails(siteId: string, data: {
    name?: string
    domainName?: string
    gtmId?: string
    googleAdsId?: string
    driveLink?: string
    marketingVault?: string // JSON string
}) {
    try {
        const updateData = { ...data }
        if (updateData.name === "") updateData.name = null as any

        const site = await prisma.site.update({
            where: { id: siteId },
            data: updateData,
        })
        revalidatePath(`/vault/${site.partnerId}/${siteId}`)
        revalidatePath(`/vault/${site.partnerId}`)
        revalidatePath("/vault/sites")
        revalidatePath("/")
    } catch (error) {
        console.error("Update site details failed:", error)
        throw new Error(error instanceof Error ? error.message : "Failed to update site")
    }
}

export async function createService(data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[] // Array of strings
    sopLink?: string
    baseFee?: number
}) {
    await prisma.service.create({
        data: {
            serviceName: data.serviceName,
            isRecurring: data.isRecurring,
            standardTasks: JSON.stringify(data.standardTasks),
            sopLink: data.sopLink,
            baseFee: data.baseFee,
        },
    })
    revalidatePath("/services")
}

export async function updateService(serviceId: string, data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[]
    sopLink?: string
    baseFee?: number
}) {
    await prisma.service.update({
        where: { id: serviceId },
        data: {
            serviceName: data.serviceName,
            isRecurring: data.isRecurring,
            standardTasks: JSON.stringify(data.standardTasks),
            sopLink: data.sopLink,
            baseFee: data.baseFee,
        },
    })
    revalidatePath("/services")
}

export async function createProject(data: {
    siteId: string
    serviceIds: string[]
    name?: string
    currentFee?: number
    status?: "Active" | "Paused" | "Completed"
    paymentStatus?: "Paid" | "Unpaid"
}) {
    try {
        // Validate input
        const validated = CreateProjectSchema.parse(data)

        // Fetch all selected services to get standard tasks
        const services = await prisma.service.findMany({
            where: { id: { in: validated.serviceIds } },
        })

        if (services.length === 0) {
            return { success: false, error: "No services found" }
        }

        // Transaction: Create Project -> Create Tasks
        const result = await prisma.$transaction(async (tx: any) => {
            // Auto-generate name if not provided
            let projectName = validated.name
            if (!projectName) {
                const site = await tx.site.findUnique({ where: { id: validated.siteId } })
                const serviceNames = services.map((s: any) => s.serviceName).join(", ")
                const isRecurring = services.some((s: any) => s.isRecurring)

                projectName = `${site?.domainName || "Project"} - ${serviceNames}`
                if (isRecurring) {
                    const date = new Date()
                    const month = date.toLocaleString('en-US', { month: 'short' })
                    const year = date.getFullYear()
                    projectName += ` - ${month} ${year}`
                }
            }

            // Create Project
            const project = await tx.project.create({
                data: {
                    siteId: validated.siteId,
                    name: projectName,
                    services: {
                        connect: validated.serviceIds.map(id => ({ id }))
                    },
                    currentFee: validated.currentFee,
                    status: validated.status || "Active",
                    paymentStatus: validated.paymentStatus || "Unpaid",
                },
                include: { site: true }
            })

            // Aggregate and deduplicate tasks
            let allStandardTasks: string[] = []
            services.forEach((service: any) => {
                try {
                    const tasks = JSON.parse(service.standardTasks)
                    if (Array.isArray(tasks)) {
                        allStandardTasks = [...allStandardTasks, ...tasks]
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            })
            const uniqueTasks = Array.from(new Set(allStandardTasks))

            // Create Tasks
            if (uniqueTasks.length > 0) {
                await tx.task.createMany({
                    data: uniqueTasks.map((taskName) => ({
                        projectId: project.id,
                        name: taskName,
                        status: "Active",
                    })),
                })
            }

            return project
        })

        if (result.site) {
            revalidatePath(`/vault/${result.site.partnerId}/${validated.siteId}`)
        }
        revalidatePath("/")
        revalidatePath("/projects")

        return { success: true, data: result }
    } catch (error: any) {
        console.error("Create project failed:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: error instanceof Error ? error.message : "Failed to create project" }
    }
}

export async function togglePaymentStatus(projectId: string, currentStatus: string) {
    const newStatus = currentStatus === "Paid" ? "Unpaid" : "Paid"
    await prisma.project.update({
        where: { id: projectId },
        data: { paymentStatus: newStatus },
    })
    revalidatePath("/ledger")
}

export async function updateProject(projectId: string, data: {
    name?: string
    status?: string
    paymentStatus?: string
    paidAt?: Date | string | null
    currentFee?: number
    serviceIds?: string[]
}) {
    try {
        // Validate partial input by making schema partial/compatible or picking fields
        // Since input data has optional fields, we can validate what's present
        // However, we need to massage the input a bit for Zod if nulls are involved

        // Manual construction before validation/update
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name === "" ? null : data.name
        if (data.status !== undefined) updateData.status = data.status
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
        if (data.paidAt !== undefined) updateData.paidAt = data.paidAt
        if (data.currentFee !== undefined) updateData.currentFee = data.currentFee
        if (data.serviceIds !== undefined) updateData.serviceIds = data.serviceIds

        const validated = UpdateProjectSchema.parse(updateData)

        const prismaUpdateData: any = { ...validated }
        delete prismaUpdateData.serviceIds // remove from direct update

        if (validated.serviceIds) {
            // Auto-update name based on new services
            const projectInfo = await prisma.project.findUnique({
                where: { id: projectId },
                include: { site: true }
            })

            const newServices = await prisma.service.findMany({
                where: { id: { in: validated.serviceIds } }
            })

            if (projectInfo && projectInfo.site && newServices.length > 0) {
                const serviceNames = newServices.map((s: any) => s.serviceName).join(", ")
                const isRecurring = newServices.some((s: any) => s.isRecurring)

                let newName = `${projectInfo.site.domainName} - ${serviceNames}`
                if (isRecurring) {
                    // Safe bet: For recurring, always stamp with current month if we are regenerating title.
                    const date = new Date()
                    const month = date.toLocaleString('en-US', { month: 'short' })
                    const year = date.getFullYear()
                    newName += ` - ${month} ${year}`
                }
                prismaUpdateData.name = newName
            }

            prismaUpdateData.services = {
                set: validated.serviceIds.map(id => ({ id }))
            }
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: prismaUpdateData,
            include: { site: true }
        })

        revalidatePath("/projects")
        revalidatePath("/")
        revalidatePath(`/vault/${project.site.partnerId}/${project.siteId}`)
        return { success: true }
    } catch (error: any) {
        console.error("Update project failed:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: (error as any).errors[0].message }
        }
        return { success: false, error: error instanceof Error ? error.message : "Failed to update project" }
    }
}

export async function addTask(projectId: string, name: string, options?: { deadline?: Date, status?: string, urgency?: string, estimatedMinutes?: number }) {
    try {
        const task: any = await prisma.task.create({
            data: {
                projectId,
                name,
                status: options?.status || "Active",
                urgency: options?.urgency || "Normal",
                isCompleted: false,
                deadline: options?.deadline,
                estimatedMinutes: options?.estimatedMinutes
            },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath(`/projects/${projectId}`)
        revalidatePath("/")
        if (task.project && task.project.site) {
            revalidatePath(`/vault/${task.project.site.partnerId}/${task.project.siteId}`)
        }
        return { success: true }
    } catch (error) {
        console.error("Add task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to add task" }
    }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string, projectId: string) {
    try {
        const isCompleted = currentStatus === "Completed"
        const newStatus = isCompleted ? "Active" : "Completed"
        const newIsCompleted = !isCompleted
        // const newIsCompleted = !isCompleted // This line is no longer needed as isCompleted is derived from newStatus

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
                isCompleted: newStatus === "Completed", // Sync
            },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath(`/projects/${projectId}`)
        revalidatePath("/")
        revalidatePath(`/vault/${task.project.site.partnerId}/${task.project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Toggle task status failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to toggle task status" }
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
        // If status is updated to Done, or isCompleted is updated to true, sync them
        const updateData: any = { ...data }

        if (data.status === "Completed") {
            updateData.isCompleted = true
        } else if (data.status && data.status !== "Completed") {
            updateData.isCompleted = false
        }

        if (data.isCompleted === true) {
            updateData.status = "Completed"
        } else if (data.isCompleted === false) {
            // Only set to Active if status isn't already something else like Paused
            if (!data.status) {
                updateData.status = "Active"
            }
        }

        const task = await prisma.task.update({
            where: { id: taskId },
            data: updateData,
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath(`/projects/${task.projectId}`)
        revalidatePath("/")
        revalidatePath(`/vault/${task.project.site.partnerId}/${task.project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Update task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update task" }
    }
}

export async function deleteTask(taskId: string, projectId: string) {
    try {
        const task = await prisma.task.delete({
            where: { id: taskId },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath(`/projects/${projectId}`)
        revalidatePath("/")
        revalidatePath(`/vault/${task.project.site.partnerId}/${task.project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" }
    }
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
        const log = await prisma.timeLog.create({
            data: {
                projectId: data.projectId,
                taskId: data.taskId, // Optional
                description: data.description,
                startTime: data.startTime || new Date(),
                endTime: data.endTime,
                durationSeconds: data.durationSeconds,
            },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/")
        // revalidatePath("/reports") // if it existed
        revalidatePath("/time")
        revalidatePath("/tasks") // Add this
        revalidatePath(`/projects/${data.projectId}`)
        revalidatePath(`/vault/${log.project.site.partnerId}/${log.project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Log time failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to log time" }
    }
}

export async function deleteProject(projectId: string) {
    try {
        const project = await prisma.project.delete({
            where: { id: projectId },
            include: { site: true }
        })
        revalidatePath("/projects")
        revalidatePath("/")
        revalidatePath(`/vault/${project.site.partnerId}/${project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete project failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete project" }
    }
}

export async function deleteProjects(projectIds: string[]) {
    try {
        if (projectIds.length === 0) return { success: true }

        await prisma.project.deleteMany({
            where: {
                id: { in: projectIds }
            }
        })

        revalidatePath("/projects")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk delete projects failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete projects" }
    }
}

export async function deleteSite(siteId: string) {
    try {
        const site = await prisma.site.delete({
            where: { id: siteId },
        })
        revalidatePath("/vault")
        revalidatePath(`/vault/${site.partnerId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete site failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete site" }
    }
}

export async function deleteTasks(taskIds: string[]) {
    try {
        if (taskIds.length === 0) return { success: true }
        await prisma.task.deleteMany({
            where: { id: { in: taskIds } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk delete tasks failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete tasks" }
    }
}

export async function updateTasksStatus(taskIds: string[], status: string) {
    try {
        if (taskIds.length === 0) return { success: true }
        const isCompleted = status === "Completed"
        await prisma.task.updateMany({
            where: { id: { in: taskIds } },
            data: { status, isCompleted }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Bulk update tasks status failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update tasks" }
    }
}

export async function getTimeLogs(filters?: { projectId?: string, partnerId?: string, q?: string }) {
    try {
        const where: any = {}

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
            }
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

export async function startTimer(projectId: string, taskId?: string) {
    try {
        // Stop any currently running timer first
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

        // Also stop (clear paused flag) any paused timers so they don't linger forever
        // Actually, if we start a NEW timer, the previous paused timer is effectively "abandoned" or just history.
        // We can optionally explicitly update them, but it's not strictly necessary unless we want to enforce only 1 paused context.
        // Let's leave them be for now. Users might want to check history.

        // Start new timer
        const log = await prisma.timeLog.create({
            data: {
                projectId,
                taskId,
                startTime: new Date(),
                endTime: null, // Indicates running timer
                durationSeconds: null
            },
            include: { project: { include: { site: true } } }
        })

        revalidatePath("/")
        revalidatePath("/time")
        revalidatePath("/tasks")
        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: log }
    } catch (error) {
        console.error("Start timer failed:", error)
        return { success: false, error: "Failed to start timer" }
    }
}

export async function stopTimer() {
    try {
        // Check for running timer
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
            // Check for paused timer to "stop" it completely (remove paused flag so it doesn't show up as actionable)
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

        revalidatePath("/")
        revalidatePath("/time")
        revalidatePath("/tasks")
        return { success: true }
    } catch (error) {
        console.error("Stop timer failed:", error)
        return { success: false, error: "Failed to stop timer" }
    }
}

export async function pauseTimer() {
    try {
        const activeTimer = await prisma.timeLog.findFirst({
            where: { endTime: null }
        })

        if (!activeTimer) {
            return { success: false, error: "No active timer found" }
        }

        const endTime = new Date()
        const durationSeconds = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000)

        // Update current log to completed AND paused
        await prisma.timeLog.update({
            where: { id: activeTimer.id },
            data: {
                endTime,
                durationSeconds,
                isPaused: true
            }
        })

        revalidatePath("/")
        revalidatePath("/time")
        revalidatePath("/tasks")
        return { success: true }
    } catch (error) {
        console.error("Pause timer failed:", error)
        return { success: false, error: "Failed to pause timer" }
    }
}

export async function resumeTimer() {
    try {
        // Find the latest paused timer
        const pausedTimer = await prisma.timeLog.findFirst({
            where: { isPaused: true },
            orderBy: { endTime: "desc" }
        })

        if (!pausedTimer) {
            return { success: false, error: "No paused timer found" }
        }

        // Start new timer with same details
        const log = await prisma.timeLog.create({
            data: {
                projectId: pausedTimer.projectId,
                taskId: pausedTimer.taskId,
                description: pausedTimer.description,
                startTime: new Date(),
                endTime: null,
            },
            include: { project: { include: { site: true } } }
        })

        // Mark old timer as NOT paused anymore (it's resumed, so the pause state is consumed)
        await prisma.timeLog.update({
            where: { id: pausedTimer.id },
            data: { isPaused: false }
        })

        revalidatePath("/")
        revalidatePath("/time")
        revalidatePath("/tasks")
        return { success: true, data: log }
    } catch (error) {
        console.error("Resume timer failed:", error)
        return { success: false, error: "Failed to resume timer" }
    }
}

export async function getActiveTimer() {
    try {
        // Prioritize running timer
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

        // If no running timer, check for paused timer
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

export async function getProjectDetails(projectId: string) {
    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                services: true,
                site: {
                    include: {
                        partner: true,
                    },
                },
                timeLogs: {
                    where: {
                        startTime: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }
                },
                tasks: {
                    include: {
                        timeLogs: true
                    },
                    orderBy: {
                        status: 'asc'
                    }
                }
            },
        })

        if (!project) return { success: false, error: "Project not found" }

        // Manually sort tasks
        const statusOrder: Record<string, number> = { "Active": 0, "Paused": 1, "Completed": 2 }
        project.tasks.sort((a, b) => {
            const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
            if (statusDiff !== 0) return statusDiff
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        return { success: true, data: JSON.parse(JSON.stringify(project)) }
    } catch (error) {
        console.error("Get project details failed:", error)
        return { success: false, error: "Failed to fetch project details" }
    }
}
