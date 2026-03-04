"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { z } from "zod"

const ServicePayloadSchema = z.object({
    serviceName: z.string().trim().min(1, "Service name is required").max(255),
    isRecurring: z.boolean(),
    standardTasks: z.array(z.string().trim().min(1)).max(200),
    sopLink: z.string().url().optional().or(z.literal("")),
    baseFee: z.number().min(0).optional(),
})

export async function createService(data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[] // Array of strings
    sopLink?: string
    baseFee?: number
}) {
    try {
        const session = await requireTenantContext()
        const validated = ServicePayloadSchema.parse(data)
        const service = await prisma.service.create({
            data: {
                tenantId: session.tenantId,
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
        const session = await requireTenantContext()
        const validatedServiceId = z.string().uuid().parse(serviceId)
        const validated = ServicePayloadSchema.parse(data)
        const updated = await prisma.service.updateMany({
            where: { id: validatedServiceId, tenantId: session.tenantId },
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
