"use server"

import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"

export async function getProjectPaymentHistory(projectId: string) {
    try {
        const session = await requireTenantContext()

        // Query audit logs that mention this project ID in the details or are general payment toggles
        const logs = await prisma.auditLog.findMany({
            where: {
                tenantId: session.tenantId,
                action: { in: ["PROJECT_PAYMENT_TOGGLED", "SETTLE_PARTNER", "SETTLE_PARTNER_VOIDED"] },
                details: { contains: projectId }
            },
            orderBy: { createdAt: "desc" },
            take: 20
        })

        return {
            success: true,
            data: logs.map(log => {
                let status = "Unknown"
                if (log.action === "SETTLE_PARTNER") status = "Paid"
                else if (log.action === "SETTLE_PARTNER_VOIDED") status = "Unpaid (Voided)"
                else if (log.action === "PROJECT_PAYMENT_TOGGLED") {
                    status = log.details?.includes('to=Paid') ? "Paid" : "Unpaid"
                }

                return {
                    id: log.id,
                    action: log.action,
                    date: log.createdAt,
                    status
                }
            })
        }
    } catch (error) {
        console.error("[payment-actions] failed to fetch history", error)
        return { success: false, error: "Failed to fetch payment history" }
    }
}
