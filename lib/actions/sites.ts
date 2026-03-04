"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireTenantContext } from "@/lib/tenant"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { z } from "zod"

const SiteIdSchema = z.string().uuid()

const CreateSiteSchema = z.object({
    partnerId: z.string().uuid(),
    domainName: z.string().trim().min(3).max(255),
})

const UpdateSiteSchema = z.object({
    siteId: z.string().uuid(),
    name: z.string().max(255).optional(),
    domainName: z.string().trim().min(3).max(255).optional(),
    gtmId: z.string().max(128).optional(),
    googleAdsId: z.string().max(128).optional(),
    driveLink: z.string().url().optional().or(z.literal("")),
    marketingVault: z.string().max(20000).optional(),
})

export async function createSite(partnerId: string, domainName: string) {
    try {
        const session = await requireTenantContext()
        const validated = CreateSiteSchema.parse({ partnerId, domainName })
        const partner = await prisma.partner.findFirst({
            where: { id: validated.partnerId, tenantId: session.tenantId },
            select: { id: true },
        })
        if (!partner) {
            throw new ActionError("PARTNER_NOT_FOUND", "Partner not found")
        }
        const site = await prisma.site.create({
            data: {
                tenantId: session.tenantId,
                partnerId: validated.partnerId,
                domainName: validated.domainName,
            }
        })
        await logSessionAuditEvent(session, {
            action: "SITE_CREATED",
            details: `siteId=${site.id}; partnerId=${validated.partnerId}`,
        })
        revalidatePath(`/vault/${validated.partnerId}`)
        revalidatePath("/vault/sites")
        return site
    } catch (error) {
        throw new Error(getActionErrorMessage(error, "Failed to create site"))
    }
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
        const session = await requireTenantContext()
        const validated = UpdateSiteSchema.parse({ siteId, ...data })
        const updateData: Prisma.SiteUpdateInput = { ...validated }
        delete (updateData as Record<string, unknown>).siteId
        if (updateData.name === "") updateData.name = null

        const site = await prisma.site.findFirst({
            where: { id: validated.siteId, tenantId: session.tenantId },
            select: { id: true, partnerId: true },
        })
        if (!site) {
            await logSessionAuditEvent(session, {
                action: "SITE_UPDATE_FAILED",
                success: false,
                details: `siteId=${validated.siteId}; reason=not_found`,
            })
            return { success: false, error: "Site not found" }
        }

        await prisma.site.update({
            where: { id: site.id },
            data: updateData,
        })
        await logSessionAuditEvent(session, {
            action: "SITE_UPDATED",
            details: `siteId=${site.id}; partnerId=${site.partnerId}`,
        })
        revalidatePath(`/vault/${site.partnerId}/${validated.siteId}`)
        revalidatePath(`/vault/${site.partnerId}`)
        revalidatePath("/vault/sites")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Update site details failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to update site") }
    }
}

export async function deleteSite(siteId: string) {
    try {
        const session = await requireTenantContext()
        const validatedSiteId = SiteIdSchema.parse(siteId)
        const site = await prisma.site.findFirst({
            where: { id: validatedSiteId, tenantId: session.tenantId },
            select: { id: true, partnerId: true },
        })
        if (!site) {
            await logSessionAuditEvent(session, {
                action: "SITE_DELETE_FAILED",
                success: false,
                details: `siteId=${validatedSiteId}; reason=not_found`,
            })
            return { success: false, error: "Site not found" }
        }
        await prisma.site.delete({ where: { id: site.id } })
        await logSessionAuditEvent(session, {
            action: "SITE_DELETED",
            details: `siteId=${site.id}; partnerId=${site.partnerId}`,
        })
        revalidatePath("/vault")
        revalidatePath(`/vault/${site.partnerId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete site failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete site") }
    }
}
