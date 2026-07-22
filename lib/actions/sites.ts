"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { normalizeExternalHttpUrl } from "@/lib/external-url"
import { resolveDomainFaviconUrl } from "@/lib/favicon"
import {
    DomainValidationError,
    validateExternalDomainHostInput,
} from "@/lib/security/domain-validation"
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
    driveLink: z.string().trim().max(2048).optional().or(z.literal("")),
    marketingVault: z.string().max(20000).optional(),
})

async function resolveNormalizedDomainAndFavicon(
    session: Awaited<ReturnType<typeof requireAuth>>,
    domainInput: string
) {
    let normalizedDomainName: string

    try {
        normalizedDomainName = await validateExternalDomainHostInput(domainInput)
    } catch (error) {
        const details = error instanceof DomainValidationError
            ? `domainInput=${domainInput}; reason=${error.code}`
            : `domainInput=${domainInput}; reason=UNKNOWN`

        await logSessionAuditEvent(session, {
            action: "SITE_DOMAIN_REJECTED",
            success: false,
            details,
        })
        throw new ActionError("INVALID_DOMAIN", "Please enter a valid public domain without custom ports.")
    }

    let faviconUrl: string | null
    try {
        faviconUrl = await resolveDomainFaviconUrl(normalizedDomainName)
    } catch (error) {
        const details = error instanceof DomainValidationError
            ? `domain=${normalizedDomainName}; reason=${error.code}`
            : `domain=${normalizedDomainName}; reason=UNKNOWN`
        await logSessionAuditEvent(session, {
            action: "SITE_FAVICON_FETCH_BLOCKED",
            success: false,
            details,
        })
        faviconUrl = `https://${normalizedDomainName}/favicon.ico`
    }

    return { normalizedDomainName, faviconUrl }
}

export async function createSite(partnerId: string, domainName: string) {
    try {
        const session = await requireAuth()
        const validated = CreateSiteSchema.parse({ partnerId, domainName })
        const partner = await prisma.partner.findFirst({
            where: { id: validated.partnerId },
            select: { id: true },
        })
        if (!partner) {
            throw new ActionError("PARTNER_NOT_FOUND", "Partner not found")
        }
        const { normalizedDomainName, faviconUrl } = await resolveNormalizedDomainAndFavicon(
            session,
            validated.domainName
        )
        const site = await prisma.site.create({
            data: {
                partnerId: validated.partnerId,
                domainName: normalizedDomainName,
                faviconUrl,
            }
        })
        await logSessionAuditEvent(session, {
            action: "SITE_CREATED",
            details: `siteId=${site.id}; partnerId=${validated.partnerId}`,
        })
        revalidatePath(`/partners/${validated.partnerId}`)
        revalidatePath(`/vault/${validated.partnerId}`)
        revalidatePath("/domains")
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
        const session = await requireAuth()
        const validated = UpdateSiteSchema.parse({ siteId, ...data })
        const updateData: Prisma.SiteUpdateInput = { ...validated }
        delete (updateData as Record<string, unknown>).siteId
        if (updateData.name === "") updateData.name = null
        if (typeof validated.domainName === "string") {
            const { normalizedDomainName, faviconUrl } = await resolveNormalizedDomainAndFavicon(
                session,
                validated.domainName
            )
            updateData.domainName = normalizedDomainName
            updateData.faviconUrl = faviconUrl
        }
        if (validated.driveLink !== undefined) {
            if (validated.driveLink === "") {
                updateData.driveLink = ""
            } else {
                const normalizedDriveLink = normalizeExternalHttpUrl(validated.driveLink)
                if (!normalizedDriveLink) {
                    return { success: false, error: "Drive link must use http or https." }
                }
                updateData.driveLink = normalizedDriveLink
            }
        }

        const site = await prisma.site.findFirst({
            where: { id: validated.siteId },
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
        revalidatePath(`/partners/${site.partnerId}/${validated.siteId}`)
        revalidatePath(`/partners/${site.partnerId}`)
        revalidatePath(`/vault/${site.partnerId}/${validated.siteId}`)
        revalidatePath(`/vault/${site.partnerId}`)
        revalidatePath("/domains")
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
        const session = await requireAuth()
        const validatedSiteId = SiteIdSchema.parse(siteId)
        const site = await prisma.site.findFirst({
            where: { id: validatedSiteId },
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
        revalidatePath("/partners")
        revalidatePath("/vault")
        revalidatePath(`/partners/${site.partnerId}`)
        revalidatePath(`/vault/${site.partnerId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete site failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete site") }
    }
}

export async function getSiteById(siteId: string) {
    try {
        await requireAuth()
        const validatedSiteId = SiteIdSchema.parse(siteId)

        const site = await prisma.site.findFirst({
            where: { id: validatedSiteId },
            include: {
                partner: {
                    select: { id: true, name: true },
                },
            },
        })

        if (!site) {
            return { success: false, error: "Site not found" }
        }

        return { success: true, site }
    } catch (error) {
        console.error("Get site by id failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to load site") }
    }
}
