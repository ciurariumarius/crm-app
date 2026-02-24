"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"

function revalidateTaskPaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/tasks")
    revalidatePath("/projects")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
}

export async function addTask(projectId: string, name: string, options?: { deadline?: Date, status?: string, urgency?: string, estimatedMinutes?: number }) {
    try {
        await requireAuth()
        const task = await prisma.task.create({
            data: {
                projectId,
                name,
                status: options?.status || "Active",
                urgency: options?.urgency || "Normal",
                deadline: options?.deadline,
                estimatedMinutes: options?.estimatedMinutes
            },
            include: { project: { include: { site: true } } }
        })
        revalidateTaskPaths(projectId, task.project?.site?.partnerId, task.project?.siteId)
        return { success: true }
    } catch (error) {
        console.error("Add task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to add task" }
    }
}

export async function toggleTaskStatus(taskId: string, currentStatus: string, projectId: string) {
    try {
        await requireAuth()
        const isCompleted = currentStatus === "Completed"
        const newStatus = isCompleted ? "Active" : "Completed"

        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: newStatus,
            },
            include: { project: { include: { site: true } } }
        })
        revalidateTaskPaths(projectId, task.project.site.partnerId, task.project.siteId)
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
        await requireAuth()
        const { isCompleted, ...restData } = data
        const updateData: Prisma.TaskUpdateInput = { ...restData }

        if (isCompleted === true) {
            updateData.status = "Completed"
        } else if (isCompleted === false && !data.status) {
            updateData.status = "Active"
        }

        const task = await prisma.task.update({
            where: { id: taskId },
            data: updateData,
            include: { project: { include: { site: true } } }
        })
        revalidateTaskPaths(task.projectId, task.project.site.partnerId, task.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Update task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update task" }
    }
}

export async function deleteTask(taskId: string, projectId: string) {
    try {
        await requireAuth()
        const task = await prisma.task.delete({
            where: { id: taskId },
            include: { project: { include: { site: true } } }
        })
        revalidateTaskPaths(projectId, task.project.site.partnerId, task.project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Delete task failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" }
    }
}

export async function deleteTasks(taskIds: string[]) {
    try {
        await requireAuth()
        if (taskIds.length === 0) return { success: true }
        await prisma.task.deleteMany({
            where: { id: { in: taskIds } }
        })
        revalidateTaskPaths()
        return { success: true }
    } catch (error) {
        console.error("Bulk delete tasks failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete tasks" }
    }
}

export async function updateTasksStatus(taskIds: string[], status: string) {
    try {
        await requireAuth()
        if (taskIds.length === 0) return { success: true }
        await prisma.task.updateMany({
            where: { id: { in: taskIds } },
            data: { status }
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
