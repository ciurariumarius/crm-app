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
    parseAndValidateExternalUrl,
} from "@/lib/security/domain-validation"
import { z } from "zod"
import { logger } from "@/lib/logger"

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
        normalizedDomainName = parseAndValidateExternalUrl(domainInput).normalizedHost
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
    let warning: { code: string; message: string } | undefined
    try {
        faviconUrl = await resolveDomainFaviconUrl(normalizedDomainName)
        if (!faviconUrl) {
            warning = {
                code: "FAVICON_UNAVAILABLE",
                message: "Site saved, but no favicon could be detected.",
            }
        }
    } catch (error) {
        const reason = error instanceof DomainValidationError
            ? error.code
            : "FAVICON_FETCH_FAILED"
        const details = error instanceof DomainValidationError
            ? `domain=${normalizedDomainName}; reason=${error.code}`
            : `domain=${normalizedDomainName}; reason=UNKNOWN`
        await logSessionAuditEvent(session, {
            action: "SITE_FAVICON_FETCH_BLOCKED",
            success: false,
            details,
        })
        faviconUrl = null
        warning = {
            code: reason,
            message: reason === "DNS_RESOLVE_FAILED"
                ? "Site saved. The domain has no active DNS yet, so its favicon is unavailable."
                : "Site saved, but its favicon could not be fetched.",
        }
    }

    return { normalizedDomainName, faviconUrl, warning }
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
        const { normalizedDomainName, faviconUrl, warning } = await resolveNormalizedDomainAndFavicon(
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
        return { success: true as const, site, warning }
    } catch (error) {
        return {
            success: false as const,
            error: getActionErrorMessage(error, "Failed to create site"),
        }
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
        let warning: { code: string; message: string } | undefined
        delete (updateData as Record<string, unknown>).siteId
        if (updateData.name === "") updateData.name = null
        if (typeof validated.domainName === "string") {
            const resolved = await resolveNormalizedDomainAndFavicon(
                session,
                validated.domainName
            )
            updateData.domainName = resolved.normalizedDomainName
            updateData.faviconUrl = resolved.faviconUrl
            warning = resolved.warning
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
        return { success: true, warning }
    } catch (error) {
        logger.error("site.update_failed", { siteId, error })
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
        logger.error("site.delete_failed", { siteId, error })
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
        logger.error("site.load_failed", { siteId, error })
        return { success: false, error: getActionErrorMessage(error, "Failed to load site") }
    }
}
