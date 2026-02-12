"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"

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
}) {
    // Fetch all selected services to get standard tasks
    const services = await prisma.service.findMany({
        where: { id: { in: data.serviceIds } },
    })

    if (services.length === 0) throw new Error("No services found")

    // Create Project with multiple services
    const project = await prisma.project.create({
        data: {
            siteId: data.siteId,
            name: data.name,
            services: {
                connect: data.serviceIds.map(id => ({ id }))
            },
            currentFee: data.currentFee,
            status: "Active",
            paymentStatus: "Unpaid",
        },
    })

    // Aggregate all standard tasks from all selected services
    let allStandardTasks: string[] = []

    services.forEach((service: any) => {
        try {
            const tasks = JSON.parse(service.standardTasks)
            if (Array.isArray(tasks)) {
                allStandardTasks = [...allStandardTasks, ...tasks]
            }
        } catch (e) {
            console.error(`Failed to parse tasks for service ${service.id}`)
        }
    })

    // Deduplicate and create tasks
    const uniqueTasks = Array.from(new Set(allStandardTasks))

    if (uniqueTasks.length > 0) {
        await prisma.task.createMany({
            data: uniqueTasks.map((taskName) => ({
                projectId: project.id,
                name: taskName,
                status: "Pending",
            })),
        })
    }

    // Need site to know partnerId for revalidation
    const site = await prisma.site.findUnique({ where: { id: data.siteId } })
    if (site) {
        revalidatePath(`/vault/${site.partnerId}/${data.siteId}`)
    }
    revalidatePath("/") // Update dashboard
    revalidatePath("/projects")
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
        // Construct update object explicitly to avoid passing unwanted fields
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name === "" ? null : data.name
        if (data.status !== undefined) updateData.status = data.status
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
        if (data.currentFee !== undefined) updateData.currentFee = data.currentFee

        if (data.serviceIds) {
            updateData.services = {
                set: data.serviceIds.map(id => ({ id }))
            }
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: updateData,
            include: { site: true }
        })

        revalidatePath("/projects")
        revalidatePath("/")
        revalidatePath(`/vault/${project.site.partnerId}/${project.siteId}`)
        return { success: true }
    } catch (error) {
        console.error("Update project failed:", error)
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
