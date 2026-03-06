"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { logAuditEvent } from "@/lib/audit"
import { requireTenantContext } from "@/lib/tenant"

export async function settlePartnerDebt(partnerId: string) {
    try {
        const session = await requireTenantContext()
        if (!session) return { success: false, error: "Unauthorized" }

        // Fetch all unpaid projects for this partner
        const unpaidProjects = await prisma.project.findMany({
            where: {
                paymentStatus: "Unpaid",
                tenantId: session.tenantId,
                site: { partnerId: partnerId }
            },
            include: {
                site: { include: { partner: true } }
            }
        })

        if (unpaidProjects.length === 0) {
            return { success: false, error: "No unpaid projects found for this partner" }
        }

        const partnerName = unpaidProjects[0].site.partner.name
        const totalAmount = unpaidProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0)

        // Bulk update to Paid
        await prisma.project.updateMany({
            where: {
                id: { in: unpaidProjects.map(p => p.id) },
                tenantId: session.tenantId
            },
            data: {
                paymentStatus: "Paid",
                paidAt: new Date()
            }
        })

        // Log the action
        await logAuditEvent({
            action: "SETTLE_PARTNER",
            success: true,
            tenantId: session.tenantId,
            actorUserId: session.userId,
            details: JSON.stringify({
                partnerId,
                partnerName,
                totalAmount,
                projectCount: unpaidProjects.length
            })
        })

        revalidatePath("/")
        revalidatePath("/projects")
        return { success: true, count: unpaidProjects.length, amount: totalAmount }
    } catch (error) {
        console.error("[settlePartnerDebt] failed", error)
        return { success: false, error: "Failed to settle partner debt" }
    }
}
