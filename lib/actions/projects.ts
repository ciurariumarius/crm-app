"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"

function revalidateProjectPaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/projects")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
}

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

export async function createProject(data: {
    siteId: string
    serviceIds: string[]
    name?: string
    currentFee?: number
    status?: "Active" | "Paused" | "Completed"
    paymentStatus?: "Paid" | "Unpaid"
}) {
    try {
        await requireAuth()
        const validated = CreateProjectSchema.parse(data)

        const services = await prisma.service.findMany({
            where: { id: { in: validated.serviceIds } },
        })

        if (services.length === 0) {
            return { success: false, error: "No services found" }
        }

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            let projectName = validated.name
            if (!projectName) {
                const site = await tx.site.findUnique({ where: { id: validated.siteId } })
                const serviceNames = services.map((s) => s.serviceName).join(", ")
                const isRecurring = services.some((s) => s.isRecurring)

                projectName = `${site?.domainName || "Project"} - ${serviceNames}`
                if (isRecurring) {
                    const date = new Date()
                    const month = date.toLocaleString('en-US', { month: 'short' })
                    const year = date.getFullYear()
                    projectName += ` - ${month} ${year}`
                }
            }

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

            let allStandardTasks: string[] = []
            services.forEach((service) => {
                try {
                    const tasks = JSON.parse(service.standardTasks)
                    if (Array.isArray(tasks)) {
                        allStandardTasks = [...allStandardTasks, ...tasks]
                    }
                } catch (e) {
                }
            })
            const uniqueTasks = Array.from(new Set(allStandardTasks))

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
    } catch (error: unknown) {
        console.error("Create project failed:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error instanceof Error ? error.message : "Failed to create project" }
    }
}

export async function togglePaymentStatus(projectId: string, currentStatus: string) {
    await requireAuth()
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
        await requireAuth()
        const updateData: Record<string, unknown> = {}
        if (data.name !== undefined) updateData.name = data.name === "" ? null : data.name
        if (data.status !== undefined) updateData.status = data.status
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
        if (data.paidAt !== undefined) updateData.paidAt = data.paidAt
        if (data.currentFee !== undefined) updateData.currentFee = data.currentFee
        if (data.serviceIds !== undefined) updateData.serviceIds = data.serviceIds

        const validated = UpdateProjectSchema.parse(updateData)

        const { serviceIds, ...restValidated } = validated
        const prismaUpdateData: Prisma.ProjectUpdateInput = { ...restValidated }

        if (validated.serviceIds) {
            const projectInfo = await prisma.project.findUnique({
                where: { id: projectId },
                include: { site: true }
            })

            const newServices = await prisma.service.findMany({
                where: { id: { in: validated.serviceIds } }
            })

            if (projectInfo && projectInfo.site && newServices.length > 0) {
                const serviceNames = newServices.map((s) => s.serviceName).join(", ")
                const isRecurring = newServices.some((s) => s.isRecurring)

                let newName = `${projectInfo.site.domainName} - ${serviceNames}`
                if (isRecurring) {
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

        revalidateProjectPaths(projectId, project.site.partnerId, project.siteId)
        return { success: true }
    } catch (error: unknown) {
        console.error("Update project failed:", error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error instanceof Error ? error.message : "Failed to update project" }
    }
}

export async function deleteProject(projectId: string) {
    try {
        await requireAuth()
        const project = await prisma.project.delete({
            where: { id: projectId },
            include: { site: true }
        })
        revalidateProjectPaths(projectId, project.site.partnerId, project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Delete project failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete project" }
    }
}

export async function deleteProjects(projectIds: string[]) {
    try {
        await requireAuth()
        if (projectIds.length === 0) return { success: true }

        await prisma.project.deleteMany({
            where: {
                id: { in: projectIds }
            }
        })

        revalidateProjectPaths()
        return { success: true }
    } catch (error) {
        console.error("Bulk delete projects failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete projects" }
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
