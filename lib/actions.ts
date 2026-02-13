"use server"

import { revalidatePath } from "next/cache"
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
                const serviceNames = services.map((s: any) => s.serviceName).join(" + ")
                const isRecurring = services.some((s: any) => s.isRecurring)

                projectName = `${site?.domainName || "Project"} - ${serviceNames}`
                if (isRecurring) {
                    const date = new Date()
                    const month = date.toLocaleString('en-US', { month: 'long' })
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
                        status: "Pending",
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
                const serviceNames = newServices.map((s: any) => s.serviceName).join(" + ")
                const isRecurring = newServices.some((s: any) => s.isRecurring)

                let newName = `${projectInfo.site.domainName} - ${serviceNames}`
                if (isRecurring) {
                    // Safe bet: For recurring, always stamp with current month if we are regenerating title.
                    const date = new Date()
                    const month = date.toLocaleString('en-US', { month: 'long' })
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

export async function addTask(projectId: string, name: string) {
    try {
        const task = await prisma.task.create({
            data: { projectId, name, status: "Pending", isCompleted: false },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/tasks")
        revalidatePath("/projects")
        revalidatePath(`/projects/${projectId}`)
        revalidatePath("/")
        revalidatePath(`/vault/${task.project.site.partnerId}/${task.project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Add task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to add task" }
    }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string, projectId: string) {
    try {
        const isDone = currentStatus === "Done"
        const newStatus = isDone ? "Pending" : "Done"
        const newIsCompleted = !isDone

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
                isCompleted: newIsCompleted
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
}) {
    try {
        // If status is updated to Done, or isCompleted is updated to true, sync them
        const updateData: any = { ...data }

        if (data.status === "Done") {
            updateData.isCompleted = true
        } else if (data.status && data.status !== "Done") {
            updateData.isCompleted = false
        }

        if (data.isCompleted === true) {
            updateData.status = "Done"
        } else if (data.isCompleted === false) {
            // Only set to Pending if status isn't already something else like In Progress
            if (!data.status) {
                updateData.status = "Pending"
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
                // taskId: data.taskId, // Optional
                description: data.description,
                startTime: data.startTime || new Date(),
                endTime: data.endTime,
                durationSeconds: data.durationSeconds,
            },
            include: { project: { include: { site: true } } }
        })
        revalidatePath("/")
        // revalidatePath("/reports") // if it existed
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
        const isCompleted = status === "Done"
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
