"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit"
import { requireAuth } from "@/lib/auth"
import { formatProjectName } from "@/lib/utils"

export async function settlePartnerDebt(partnerId: string) {
    try {
        const session = await requireAuth()

        // Fetch all unpaid projects for this partner
        const unpaidProjects = await prisma.project.findMany({
            where: {
                paymentStatus: "Unpaid",
                site: { partnerId: partnerId }
            },
            include: {
                site: { include: { partner: true } },
                services: true,
                timeLogs: true,
                _count: { select: { tasks: true } },
                tasks: true
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
            actorUserId: session.userId,
            details: JSON.stringify({
                partnerId,
                partnerName,
                totalAmount,
                projectCount: unpaidProjects.length,
                projects: unpaidProjects.map(p => ({
                    id: p.id,
                    name: formatProjectName(p),
                    fee: p.currentFee
                }))
            })
        })

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/partners")
        revalidatePath("/vault")
        revalidatePath(`/partners/${partnerId}`)
        revalidatePath(`/vault/${partnerId}`)
        return { success: true, count: unpaidProjects.length, amount: totalAmount }
    } catch (error) {
        console.error("[settlePartnerDebt] failed", error)
        return { success: false, error: "Failed to settle partner debt" }
    }
}

export async function voidSettlement(auditLogId: string) {
    try {
        const session = await requireAuth()

        const log = await prisma.auditLog.findUnique({
            where: { id: auditLogId }
        })

        if (!log || log.action !== "SETTLE_PARTNER") {
            return { success: false, error: "Settlement log not found" }
        }

        const details = JSON.parse(log.details || "{}") as {
            partnerId?: string
            projects?: Array<{ id: string }>
        }
        const projectIds = (details.projects || []).map((p) => p.id)

        if (projectIds.length > 0) {
            await prisma.project.updateMany({
                where: {
                    id: { in: projectIds },
                },
                data: {
                    paymentStatus: "Unpaid",
                    paidAt: null
                }
            })
        }

        // Log the void action as a new event
        await logAuditEvent({
            action: "SETTLE_PARTNER_VOIDED",
            success: true,
            actorUserId: session.userId,
            details: JSON.stringify({
                auditLogId,
                partnerId: details.partnerId,
                projectCount: projectIds.length,
                projects: details.projects
            })
        })

        revalidatePath("/")
        revalidatePath("/projects")
        revalidatePath("/partners")
        revalidatePath("/vault")
        if (details.partnerId) {
            revalidatePath(`/partners/${details.partnerId}`)
            revalidatePath(`/vault/${details.partnerId}`)
        }
        return { success: true }
    } catch (error) {
        console.error("[voidSettlement] failed", error)
        return { success: false, error: "Failed to void settlement" }
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
