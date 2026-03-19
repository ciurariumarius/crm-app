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

const AddAdHocPaymentSchema = z.object({
    partnerId: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    description: z.string().max(2000).optional(),
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

export async function getPartnerById(partnerId: string) {
    try {
        const session = await requireTenantContext()
        const partnerRaw = await prisma.partner.findFirst({
            where: { id: partnerId, tenantId: session.tenantId },
            include: {
                sites: {
                    include: {
                        _count: { select: { projects: true } }
                    },
                    orderBy: { createdAt: "desc" }
                }
            }
        })

        if (!partnerRaw) {
            return { success: false, error: "Partner not found" }
        }

        // Serialize decimal/date objects for Client Component transmission
        const partner = JSON.parse(JSON.stringify(partnerRaw))
        return { success: true, partner }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to fetch partner") }
    }
}

export async function addPartnerAdHocPayment(data: {
    partnerId: string
    name: string
    amount: number
    description?: string
}) {
    try {
        const session = await requireTenantContext()
        const validated = AddAdHocPaymentSchema.parse(data)

        // Find or create a generic Site for this Partner
        let site = await prisma.site.findFirst({
            where: {
                tenantId: session.tenantId,
                partnerId: validated.partnerId,
                domainName: "ad-hoc-payments.local"
            }
        })

        if (!site) {
            site = await prisma.site.create({
                data: {
                    tenantId: session.tenantId,
                    partnerId: validated.partnerId,
                    domainName: "ad-hoc-payments.local",
                    name: "Ad-Hoc Payments",
                }
            })
        }

        // Find or create a generic Service
        let service = await prisma.service.findFirst({
            where: {
                tenantId: session.tenantId,
                serviceName: "Ad-Hoc Payment",
                isRecurring: false
            }
        })

        if (!service) {
            service = await prisma.service.create({
                data: {
                    tenantId: session.tenantId,
                    serviceName: "Ad-Hoc Payment",
                    isRecurring: false,
                    standardTasks: JSON.stringify([])
                }
            })
        }

        const project = await prisma.project.create({
            data: {
                tenantId: session.tenantId,
                siteId: site.id,
                name: validated.name,
                description: validated.description || null,
                status: "Completed",
                paymentStatus: "Paid",
                paidAt: new Date(),
                currentFee: validated.amount,
                services: {
                    connect: { id: service.id }
                }
            }
        })

        await logSessionAuditEvent(session, {
            action: "PARTNER_AD_HOC_PAYMENT_ADDED",
            details: `partnerId=${validated.partnerId}; projectId=${project.id}; amount=${validated.amount}`,
        })

        revalidatePath("/")
        revalidatePath("/dashboard")
        revalidatePath("/partners")
        revalidatePath(`/partners/${validated.partnerId}`)
        revalidatePath("/vault")
        revalidatePath(`/vault/${validated.partnerId}`)
        
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to add payment") }
    }
}
