"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit"
import { requireAuth } from "@/lib/auth"
import { formatProjectName } from "@/lib/utils"
import {
    isProjectStillInSettlementState,
    parseSettlementAuditDetails,
} from "@/lib/payments/settlement-audit"

function revalidateSettlementPaths(partnerId?: string) {
    revalidatePath("/")
    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/partners")
    revalidatePath("/vault")
    if (partnerId) {
        revalidatePath(`/partners/${partnerId}`)
        revalidatePath(`/vault/${partnerId}`)
    }
}

type SettlementActionFailure = {
    success: false
    error: string
}

type SettlePartnerDebtResult = SettlementActionFailure | {
    success: true
    count: number
    amount: number
    auditLogId: string
}

type VoidSettlementResult = SettlementActionFailure | {
    success: true
    count: number
    skippedCount: number
}

type VoidSettlementTransactionResult = {
    ok: false
    error: string
} | {
    ok: true
    partnerId?: string
    count: number
    skippedCount: number
}

export async function settlePartnerDebt(partnerId: string): Promise<SettlePartnerDebtResult> {
    try {
        const session = await requireAuth()

        const result = await prisma.$transaction(async (tx) => {
            const unpaidProjects = await tx.project.findMany({
                where: {
                    paymentStatus: "Unpaid",
                    site: { partnerId }
                },
                include: {
                    site: { include: { partner: true } },
                    services: true,
                }
            })

            if (unpaidProjects.length === 0) return null

            const partnerName = unpaidProjects[0].site.partner.name
            const totalAmount = unpaidProjects.reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)
            const settledAt = new Date()
            const projectSnapshots = unpaidProjects.map((project) => ({
                id: project.id,
                name: formatProjectName(project),
                fee: Number(project.currentFee) || 0,
            }))

            const updated = await tx.project.updateMany({
                where: {
                    id: { in: unpaidProjects.map((project) => project.id) },
                    paymentStatus: "Unpaid",
                },
                data: {
                    paymentStatus: "Paid",
                    paidAt: settledAt,
                }
            })

            if (updated.count !== unpaidProjects.length) {
                throw new Error("Payment state changed while settling partner")
            }

            const auditLog = await tx.auditLog.create({
                data: {
                    action: "SETTLE_PARTNER",
                    success: true,
                    actorUserId: session.userId,
                    details: JSON.stringify({
                        partnerId,
                        partnerName,
                        totalAmount,
                        projectCount: projectSnapshots.length,
                        settledAt: settledAt.toISOString(),
                        projects: projectSnapshots,
                    }),
                }
            })

            return {
                count: projectSnapshots.length,
                amount: totalAmount,
                auditLogId: auditLog.id,
            }
        })

        if (!result) {
            return { success: false, error: "No unpaid projects found for this partner" }
        }

        revalidateSettlementPaths(partnerId)
        return { success: true, ...result }
    } catch (error) {
        console.error("[settlePartnerDebt] failed", error)
        return { success: false, error: "Failed to settle partner debt" }
    }
}

export async function voidSettlement(auditLogId: string): Promise<VoidSettlementResult> {
    try {
        const session = await requireAuth()

        const result: VoidSettlementTransactionResult = await prisma.$transaction(async (tx): Promise<VoidSettlementTransactionResult> => {
            const log = await tx.auditLog.findUnique({ where: { id: auditLogId } })
            if (!log || log.action !== "SETTLE_PARTNER") {
                return { ok: false, error: "Settlement log not found" } as const
            }

            const existingVoid = await tx.auditLog.findFirst({
                where: {
                    action: "SETTLE_PARTNER_VOIDED",
                    success: true,
                    details: { contains: auditLogId },
                },
                select: { id: true },
            })
            if (existingVoid) {
                return { ok: false, error: "This settlement has already been reverted" } as const
            }

            const details = parseSettlementAuditDetails(log.details)
            if (!details) {
                return { ok: false, error: "Settlement details are unavailable" } as const
            }

            const projectIds = details.projects.map((project) => project.id)
            const projects = await tx.project.findMany({
                where: { id: { in: projectIds } },
                select: { id: true, paymentStatus: true, paidAt: true },
            })
            const reversibleProjects = projects
                .filter((project) => isProjectStillInSettlementState(project, {
                    createdAt: log.createdAt,
                    settledAt: details.settledAt,
                }))
            const reversibleIds = reversibleProjects.map((project) => project.id)

            if (reversibleIds.length === 0) {
                return { ok: false, error: "These projects were changed after the settlement and cannot be safely reverted" } as const
            }

            const updated = await tx.project.updateMany({
                where: {
                    OR: reversibleProjects.map((project) => ({
                        id: project.id,
                        paymentStatus: "Paid",
                        paidAt: project.paidAt,
                    })),
                },
                data: {
                    paymentStatus: "Unpaid",
                    paidAt: null,
                }
            })
            if (updated.count !== reversibleProjects.length) {
                throw new Error("Payment state changed while reverting settlement")
            }

            const revertedProjects = details.projects.filter((project) => reversibleIds.includes(project.id))
            const totalAmount = revertedProjects.reduce((sum, project) => sum + (Number(project.fee) || 0), 0)
            await tx.auditLog.create({
                data: {
                    action: "SETTLE_PARTNER_VOIDED",
                    success: true,
                    actorUserId: session.userId,
                    details: JSON.stringify({
                        auditLogId,
                        partnerId: details.partnerId,
                        partnerName: details.partnerName,
                        projectCount: updated.count,
                        skippedProjectCount: projectIds.length - updated.count,
                        totalAmount,
                        projects: revertedProjects,
                    }),
                }
            })

            return {
                ok: true,
                partnerId: details.partnerId,
                count: updated.count,
                skippedCount: projectIds.length - updated.count,
            }
        })

        if (!result.ok) return { success: false, error: result.error }

        revalidateSettlementPaths(result.partnerId)
        return { success: true, count: result.count, skippedCount: result.skippedCount }
    } catch (error) {
        console.error("[voidSettlement] failed", error)
        return { success: false, error: "Failed to revert settlement" }
    }
}

export async function settleProject(projectId: string) {
    try {
        const session = await requireAuth()

        const project = await prisma.project.findFirst({
            where: { id: projectId },
            include: { site: { include: { partner: true } } }
        })

        if (!project) return { success: false, error: "Project not found" }
        if (project.paymentStatus === "Paid") return { success: true }

        const amount = Number(project.currentFee) || 0
        const partnerName = project.site.partner.name
        const partnerId = project.site.partnerId

        await prisma.project.update({
            where: { id: projectId },
            data: {
                paymentStatus: "Paid",
                paidAt: new Date()
            }
        })

        // Log the action
        await logAuditEvent({
            action: "SETTLE_PARTNER",
            success: true,
            actorUserId: session.userId,
            details: JSON.stringify({
                partnerId,
                partnerName,
                totalAmount: amount,
                projectCount: 1,
                projects: [{
                    id: project.id,
                    name: project.name,
                    fee: project.currentFee
                }]
            })
        })

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/partners")
        revalidatePath("/vault")
        revalidatePath(`/partners/${partnerId}`)
        return { success: true, amount }
    } catch (error) {
        console.error("[settleProject] failed", error)
        return { success: false, error: "Failed to settle project" }
    }
}
