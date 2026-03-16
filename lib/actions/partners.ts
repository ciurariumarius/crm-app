"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { z } from "zod"

const CreatePartnerSchema = z.object({
    name: z.string().trim().min(1, "Partner name is required"),
    isMainJob: z.boolean(),
    internalNotes: z.string().max(5000).optional(),
})

const UpdatePartnerSchema = z.object({
    partnerId: z.string().uuid(),
    name: z.string().trim().min(1, "Partner name is required"),
    businessName: z.string().trim().max(255).optional(),
    isMainJob: z.boolean(),
    emailPrimary: z.string().email().optional().or(z.literal("")),
    emailSecondary: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(64).optional(),
    internalNotes: z.string().max(5000).optional(),
})

export async function createPartner(data: {
    name: string
    isMainJob: boolean
    internalNotes?: string
    }) {
    try {
        const session = await requireTenantContext()
        const validated = CreatePartnerSchema.parse(data)
        const partner = await prisma.partner.create({
            data: {
                tenantId: session.tenantId,
                name: validated.name,
                isMainJob: validated.isMainJob,
                internalNotes: validated.internalNotes,
            },
        })
        await logSessionAuditEvent(session, {
            action: "PARTNER_CREATED",
            details: `partnerId=${partner.id}`,
        })
        revalidatePath("/partners")
        revalidatePath("/vault")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to create partner") }
    }
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
    try {
        const session = await requireTenantContext()
        const validated = UpdatePartnerSchema.parse({ partnerId, ...data })
        const updated = await prisma.partner.updateMany({
            where: { id: validated.partnerId, tenantId: session.tenantId },
            data: {
                name: validated.name,
                businessName: validated.businessName || null,
                isMainJob: validated.isMainJob,
                emailPrimary: validated.emailPrimary || null,
                emailSecondary: validated.emailSecondary || null,
                phone: validated.phone || null,
                internalNotes: validated.internalNotes,
            },
        })
        if (updated.count === 0) {
            await logSessionAuditEvent(session, {
                action: "PARTNER_UPDATE_FAILED",
                success: false,
                details: `partnerId=${validated.partnerId}; reason=not_found`,
            })
            return { success: false, error: "Partner not found" }
        }
        await logSessionAuditEvent(session, {
            action: "PARTNER_UPDATED",
            details: `partnerId=${validated.partnerId}`,
        })
        revalidatePath("/partners")
        revalidatePath(`/partners/${validated.partnerId}`)
        revalidatePath("/vault")
        revalidatePath(`/vault/${validated.partnerId}`)
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to update partner") }
    }
}

export async function deletePartner(partnerId: string) {
    try {
        const session = await requireTenantContext()
        const validatedPartnerId = z.string().uuid().parse(partnerId)
        const deleted = await prisma.partner.deleteMany({
            where: { id: validatedPartnerId, tenantId: session.tenantId },
        })
        if (deleted.count === 0) {
            await logSessionAuditEvent(session, {
                action: "PARTNER_DELETE_FAILED",
                success: false,
                details: `partnerId=${validatedPartnerId}; reason=not_found`,
            })
            return { success: false, error: "Partner not found" }
        }
        await logSessionAuditEvent(session, {
            action: "PARTNER_DELETED",
            details: `partnerId=${validatedPartnerId}`,
        })
        revalidatePath("/partners")
        revalidatePath("/vault")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to delete partner") }
    }
}
