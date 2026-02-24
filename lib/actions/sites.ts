"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"

export async function createSite(partnerId: string, domainName: string) {
    await requireAuth()
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
        await requireAuth()
        const updateData: Prisma.SiteUpdateInput = { ...data }
        if (updateData.name === "") updateData.name = null

        const site = await prisma.site.update({
            where: { id: siteId },
            data: updateData,
        })
        revalidatePath(`/vault/${site.partnerId}/${siteId}`)
        revalidatePath(`/vault/${site.partnerId}`)
        revalidatePath("/vault/sites")
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Update site details failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update site" }
    }
}

export async function deleteSite(siteId: string) {
    try {
        await requireAuth()
        const site = await prisma.site.delete({
            where: { id: siteId },
        })
        revalidatePath("/vault")
        revalidatePath(`/vault/${site.partnerId}`)
        return { success: true }
    } catch (error) {
        console.error("Delete site failed:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete site" }
    }
}
