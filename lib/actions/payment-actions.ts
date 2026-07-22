"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { Prisma } from "@prisma/client"

export async function getProjectPaymentHistory(projectId: string) {
    try {
        await requireAuth()

        const logs = await prisma.auditLog.findMany({
            where: {
                action: { in: ["PROJECT_PAYMENT_TOGGLED", "SETTLE_PARTNER", "SETTLE_PARTNER_VOIDED", "PARTNER_AD_HOC_PAYMENT_ADDED"] },
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
                else if (log.action === "PARTNER_AD_HOC_PAYMENT_ADDED") status = "Paid (Manual)"
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

export async function getProjectStatusHistory(projectId: string) {
    try {
        await requireAuth()

        const logs = await prisma.auditLog.findMany({
            where: {
                action: { in: ["PROJECT_STATUS_CHANGED", "PROJECT_CREATED", "PROJECT_CLOSED", "PROJECT_REOPENED"] },
                details: { contains: `projectId=${projectId}` },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
        })

        return {
            success: true,
            data: logs.map((log) => {
                if (log.action === "PROJECT_CREATED") {
                    return {
                        id: log.id,
                        action: log.action,
                        date: log.createdAt,
                        fromStatus: null,
                        toStatus: "Created",
                        source: "initial_create",
                    }
                }

                if (log.action === "PROJECT_CLOSED") {
                    const details = log.details || ""
                    const sourceMatch = details.match(/(?:^|;\s*)source=([^;]+)/)

                    return {
                        id: log.id,
                        action: log.action,
                        date: log.createdAt,
                        fromStatus: null,
                        toStatus: "Closed",
                        source: sourceMatch?.[1]?.trim() || null,
                    }
                }

                if (log.action === "PROJECT_REOPENED") {
                    const details = log.details || ""
                    const sourceMatch = details.match(/(?:^|;\s*)source=([^;]+)/)

                    return {
                        id: log.id,
                        action: log.action,
                        date: log.createdAt,
                        fromStatus: "Closed",
                        toStatus: "Reopened",
                        source: sourceMatch?.[1]?.trim() || "manual_reopen",
                    }
                }

                const details = log.details || ""
                const toMatch = details.match(/(?:^|;\s*)to=([^;]+)/)
                const fromMatch = details.match(/(?:^|;\s*)from=([^;]+)/)
                const sourceMatch = details.match(/(?:^|;\s*)source=([^;]+)/)

                return {
                    id: log.id,
                    action: log.action,
                    date: log.createdAt,
                    fromStatus: fromMatch?.[1]?.trim() || null,
                    toStatus: toMatch?.[1]?.trim() || "Unknown",
                    source: sourceMatch?.[1]?.trim() || null,
                }
            }),
        }
    } catch (error) {
        console.error("[payment-actions] failed to fetch status history", error)
        return { success: false, error: "Failed to fetch status history" }
    }
}

export async function getPaymentLogs(params: {
    projectId?: string;
    partnerId?: string;
    q?: string;
    timeRange?: string;
    take?: number;
    skip?: number;
}) {
    try {
        await requireAuth()
        const { projectId, partnerId, q, timeRange, take = 50, skip = 0 } = params

        const where: Prisma.AuditLogWhereInput = {
            action: { in: ["PROJECT_PAYMENT_TOGGLED", "SETTLE_PARTNER", "SETTLE_PARTNER_VOIDED", "PARTNER_AD_HOC_PAYMENT_ADDED"] }
        }

        const conditions: Prisma.AuditLogWhereInput[] = []

        if (q) {
            conditions.push({ details: { contains: q } })
        }

        if (projectId) {
            conditions.push({ details: { contains: `projectId=${projectId}` } })
        } else if (partnerId) {
            conditions.push({ details: { contains: `partnerId=${partnerId}` } })
        }

        if (timeRange) {
            const now = new Date()
            let gte: Date | undefined
            let lte: Date | undefined

            if (timeRange === "7d") {
                gte = new Date(now.setDate(now.getDate() - 7))
            } else if (timeRange === "30d") {
                gte = new Date(now.setDate(now.getDate() - 30))
            } else if (timeRange === "this_month") {
                gte = new Date(now.getFullYear(), now.getMonth(), 1)
            } else if (timeRange === "last_month") {
                gte = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                lte = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            }

            if (gte || lte) {
                conditions.push({
                    createdAt: {
                        ...(gte ? { gte } : {}),
                        ...(lte ? { lte } : {})
                    }
                })
            }
        }

        if (conditions.length > 0) {
            where.AND = conditions
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
                else if (log.action === "PARTNER_AD_HOC_PAYMENT_ADDED") status = "Paid (Manual)"
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
        return { success: false, error: "Failed to fetch payments" }
    }
}
