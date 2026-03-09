"use server"

import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { Prisma } from "@prisma/client"

export async function getProjectPaymentHistory(projectId: string) {
    try {
        const session = await requireTenantContext()

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

export async function getPaymentLogs(params: {
    projectId?: string;
    partnerId?: string;
    take?: number;
    skip?: number;
}) {
    try {
        const session = await requireTenantContext()
        const { projectId, partnerId, take = 50, skip = 0 } = params

        const where: Prisma.AuditLogWhereInput = {
            tenantId: session.tenantId,
            action: { in: ["PROJECT_PAYMENT_TOGGLED", "SETTLE_PARTNER", "SETTLE_PARTNER_VOIDED"] }
        }

        if (projectId) {
            where.details = { contains: `projectId=${projectId}` }
        } else if (partnerId) {
            where.details = { contains: `partnerId=${partnerId}` }
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take,
                skip
            }),
            prisma.auditLog.count({ where })
        ])

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
                    status,
                    details: log.details
                }
            }),
            total
        }
    } catch (error) {
        console.error("[payment-actions] failed to fetch logs", error)
        return { success: false, error: "Failed to fetch payment logs" }
    }
}
