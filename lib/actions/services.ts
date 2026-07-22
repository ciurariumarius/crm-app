"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { Prisma } from "@prisma/client"
import { z } from "zod"

const ServicePayloadSchema = z.object({
    serviceName: z.string().trim().min(1, "Service name is required").max(255),
    isRecurring: z.boolean(),
    standardTasks: z.array(z.string().trim().min(1)).max(200),
    sopLink: z.string().url().optional().or(z.literal("")),
    baseFee: z.number().min(0).optional(),
})

const SearchProjectServicesSchema = z.object({
    query: z.string().trim().max(100),
    cadence: z.enum(["all", "recurring", "one-time"]).default("all"),
    limit: z.number().int().min(1).max(100).default(40),
})

export async function createService(data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[] // Array of strings
    sopLink?: string
    baseFee?: number
}) {
    try {
        const session = await requireAuth()
        const validated = ServicePayloadSchema.parse(data)
        const service = await prisma.service.create({
            data: {
                serviceName: validated.serviceName,
                isRecurring: validated.isRecurring,
                standardTasks: JSON.stringify(validated.standardTasks),
                sopLink: validated.sopLink || null,
                baseFee: validated.baseFee,
            },
        })
        await logSessionAuditEvent(session, {
            action: "SERVICE_CREATED",
            details: `serviceId=${service.id}`,
        })
        revalidatePath("/services")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to create service") }
    }
}

export async function updateService(serviceId: string, data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[]
    sopLink?: string
    baseFee?: number
}) {
    try {
        const session = await requireAuth()
        const validatedServiceId = z.string().uuid().parse(serviceId)
        const validated = ServicePayloadSchema.parse(data)
        const updated = await prisma.service.updateMany({
            where: { id: validatedServiceId },
            data: {
                serviceName: validated.serviceName,
                isRecurring: validated.isRecurring,
                standardTasks: JSON.stringify(validated.standardTasks),
                sopLink: validated.sopLink || null,
                baseFee: validated.baseFee,
            },
        })
        if (updated.count === 0) {
            await logSessionAuditEvent(session, {
                action: "SERVICE_UPDATE_FAILED",
                success: false,
                details: `serviceId=${validatedServiceId}; reason=not_found`,
            })
            return { success: false, error: "Service not found" }
        }
        await logSessionAuditEvent(session, {
            action: "SERVICE_UPDATED",
            details: `serviceId=${validatedServiceId}`,
        })
        revalidatePath("/services")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to update service") }
    }
}

export async function deleteService(serviceId: string) {
    try {
        const session = await requireAuth()
        const validatedServiceId = z.string().uuid().parse(serviceId)

        // Check if the service exists and belongs to the tenant
        const service = await prisma.service.findFirst({
            where: { id: validatedServiceId },
        })

        if (!service) {
            return { success: false, error: "Service not found" }
        }

        await prisma.service.delete({
            where: { id: validatedServiceId },
        })

        await logSessionAuditEvent(session, {
            action: "SERVICE_DELETED",
            details: `serviceId=${validatedServiceId}; serviceName=${service.serviceName}`,
        })

        revalidatePath("/services")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to delete service") }
    }
}

export async function searchProjectServices(
    query: string,
    cadence: "all" | "recurring" | "one-time" = "all",
    limit = 40
) {
    try {
        await requireAuth()
        const validated = SearchProjectServicesSchema.parse({ query, cadence, limit })

        if (!validated.query) {
            return []
        }

        const where: Prisma.ServiceWhereInput = {
            serviceName: { contains: validated.query },
        }

        if (validated.cadence === "recurring") {
            where.isRecurring = true
        } else if (validated.cadence === "one-time") {
            where.isRecurring = false
        }

        const services = await prisma.service.findMany({
            where,
            orderBy: { serviceName: "asc" },
            take: validated.limit,
            select: {
                id: true,
                serviceName: true,
                isRecurring: true,
                baseFee: true,
            },
        })

        return JSON.parse(JSON.stringify(services))
    } catch (error) {
        console.error("[services] searchProjectServices failed", error)
        return []
    }
}
