"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
    hasCurrentNotesWriteProtocol,
    NOTES_CLIENT_REFRESH_MESSAGE,
    NOTES_CLIENT_REFRESH_REQUIRED,
} from "@/lib/notes/write-protocol"
import { requireAuth } from "@/lib/auth"
import { ActionError, getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { PROJECT_STATUS_VALUES, taskStatusSortOrder } from "@/lib/status"
import { formatProjectName } from "@/lib/utils"
import { z } from "zod"
import { format } from "date-fns"
import { logger } from "@/lib/logger"
import { removeDrawingPreview } from "@/lib/notes/drawings.server"
import { normalizeRichTextContent } from "@/lib/notes/content"
import { normalizePaymentMethod } from "@/lib/payments/methods"
import { resolveRecurringRolloverFee } from "@/lib/projects/recurring-fee"

function revalidateProjectPaths(projectId?: string, sitePartnerId?: string, siteId?: string) {
    revalidatePath("/projects")
    revalidatePath("/")
    if (projectId) revalidatePath(`/projects/${projectId}`)
    if (sitePartnerId && siteId) {
        revalidatePath(`/partners/${sitePartnerId}/${siteId}`)
        revalidatePath(`/vault/${sitePartnerId}/${siteId}`)
    }
}

const CreateProjectSchema = z.object({
    siteId: z.string().trim().min(1, "Invalid site id"),
    serviceIds: z.array(z.string().trim().min(1, "Invalid service id")).min(1, "At least one service must be selected"),
    name: z.string().optional(),
    currentFee: z.number().optional().nullable(),
    status: z.enum(PROJECT_STATUS_VALUES).optional(),
    paymentStatus: z.enum(["Paid", "Unpaid"]).optional(),
})

const UpdateProjectSchema = z.object({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    status: z.enum(PROJECT_STATUS_VALUES).optional(),
    paymentStatus: z.enum(["Paid", "Unpaid"]).optional(),
    paidAt: z.union([z.date(), z.string(), z.null()]).optional(),
    closedAt: z.union([z.date(), z.string(), z.null()]).optional(),
    isHeavyRevenueMonth: z.boolean().optional(),
    createdAt: z.union([z.date(), z.string()]).optional(),
    currentFee: z.number().nullable().optional(),
    serviceIds: z.array(z.string().trim().min(1, "Invalid service id")).optional(),
})

const ProjectIdSchema = z.string().trim().min(1, "Invalid project id")
const ProjectIdsSchema = z.array(ProjectIdSchema).max(200)
const PaymentStatusSchema = z.enum(["Paid", "Unpaid"])
const PaymentMethodSchema = z.string().trim().min(1, "Payment method is required").max(64)
const SetProjectPaymentStateSchema = z.object({
    projectId: z.string().uuid("Invalid project id"),
    expectedStatus: PaymentStatusSchema,
    nextStatus: PaymentStatusSchema,
    amount: z.number().positive("Amount must be positive").optional(),
    paymentMethod: PaymentMethodSchema.optional(),
}).refine((data) => data.expectedStatus !== data.nextStatus, {
    message: "Choose a different payment status",
    path: ["nextStatus"],
})

const ReopenRecurringProjectSchema = z.object({
    projectId: z.string().uuid("Invalid project id"),
    targetYear: z.number().int().min(2000).max(2100),
    targetMonth: z.number().int().min(1).max(12),
})

function parseClosureDateInput(value: Date | string) {
    if (value instanceof Date) return value

    const trimmed = value.trim()
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
        const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch
        const year = Number(yearRaw)
        const month = Number(monthRaw)
        const day = Number(dayRaw)
        const localDate = new Date(year, month - 1, day, 12, 0, 0, 0)
        if (
            localDate.getFullYear() === year &&
            localDate.getMonth() === month - 1 &&
            localDate.getDate() === day
        ) {
            return localDate
        }
        return new Date(Number.NaN)
    }

    return new Date(trimmed)
}

export async function createProject(data: {
    siteId: string
    serviceIds: string[]
    name?: string
    currentFee?: number
    status?: "Active" | "Paused" | "Completed" | "Closed"
    paymentStatus?: "Paid" | "Unpaid"
}) {
    try {
        const session = await requireAuth()
        const validated = CreateProjectSchema.parse(data)
        const uniqueServiceIds = Array.from(new Set(validated.serviceIds))

        const services = await prisma.service.findMany({
            where: { id: { in: uniqueServiceIds } },
        })

        if (services.length === 0) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_CREATE_FAILED",
                success: false,
                details: `siteId=${validated.siteId}; reason=no_services`,
            })
            return { success: false, error: "No services found" }
        }
        if (services.length !== uniqueServiceIds.length) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_CREATE_FAILED",
                success: false,
                details: `siteId=${validated.siteId}; reason=service_scope_mismatch`,
            })
            return { success: false, error: "One or more services are inaccessible" }
        }

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const site = await tx.site.findFirst({
                where: { id: validated.siteId },
                select: { id: true, domainName: true },
            })
            if (!site) {
                throw new ActionError("SITE_NOT_FOUND", "Site not found")
            }

            let projectName = validated.name
            if (!projectName) {
                projectName = formatProjectName({
                    siteName: site.domainName,
                    services,
                    createdAt: new Date(),
                })
            }

            const isRecurring = services.some((service) => service.isRecurring)
            const project = await tx.project.create({
                data: {
                    siteId: validated.siteId,
                    name: projectName,
                    services: {
                        connect: uniqueServiceIds.map(id => ({ id }))
                    },
                    currentFee: validated.currentFee,
                    recurringBaseFee: isRecurring ? validated.currentFee : null,
                    status: validated.status || "Active",
                    paymentStatus: validated.paymentStatus || "Unpaid",
                    paidAt: validated.paymentStatus === "Paid" ? new Date() : null,
                },
                include: { site: true }
            })

            let allStandardTasks: string[] = []
            services.forEach((service) => {
                try {
                    const tasks = JSON.parse(service.standardTasks)
                    if (Array.isArray(tasks)) {
                        allStandardTasks = [...allStandardTasks, ...tasks]
                    }
                } catch {
                    // Ignore malformed service task templates to avoid blocking project creation.
                }
            })
            const uniqueTasks = Array.from(new Set(allStandardTasks))

            if (uniqueTasks.length > 0) {
                await tx.task.createMany({
                    data: uniqueTasks.map((taskName) => ({
                        projectId: project.id,
                        taskScope: "FREELANCE",
                        name: taskName,
                        status: "Active",
                    })),
                })
            }

            return project
        })

        if (result.site) {
            revalidatePath(`/partners/${result.site.partnerId}/${validated.siteId}`)
            revalidatePath(`/vault/${result.site.partnerId}/${validated.siteId}`)
        }
        revalidatePath("/")
        revalidatePath("/projects")
        await logSessionAuditEvent(session, {
            action: "PROJECT_CREATED",
            details: `projectId=${result.id}; siteId=${validated.siteId}`,
        })

        return { success: true, data: result }
    } catch (error: unknown) {
        console.error("Create project failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to create project") }
    }
}

export async function reopenRecurringProject(input: {
    projectId: string
    targetYear: number
    targetMonth: number
}) {
    try {
        const session = await requireAuth()
        const validated = ReopenRecurringProjectSchema.parse(input)
        const targetDate = new Date(validated.targetYear, validated.targetMonth - 1, 1, 12, 0, 0, 0)
        const targetEnd = new Date(validated.targetYear, validated.targetMonth, 1, 12, 0, 0, 0)

        const result = await prisma.$transaction(async (tx) => {
            const source = await tx.project.findUnique({
                where: { id: validated.projectId },
                include: {
                    site: { select: { id: true, partnerId: true, domainName: true } },
                    services: {
                        select: {
                            id: true,
                            serviceName: true,
                            standardTasks: true,
                            isRecurring: true,
                        },
                    },
                },
            })
            if (!source) throw new ActionError("PROJECT_NOT_FOUND", "Project not found")
            if (!source.services.some((service) => service.isRecurring)) {
                throw new ActionError("PROJECT_NOT_RECURRING", "Only recurring projects can be opened for another month")
            }
            if (source.status !== "Closed" && source.status !== "Completed") {
                throw new ActionError("PROJECT_NOT_CLOSED", "Complete or close the current month before opening another month")
            }

            const sourceMonth = source.createdAt.getFullYear() * 12 + source.createdAt.getMonth()
            const targetMonth = validated.targetYear * 12 + validated.targetMonth - 1
            if (targetMonth <= sourceMonth) {
                throw new ActionError("INVALID_TARGET_MONTH", "Choose a month after the source project month")
            }

            const markerWhere = {
                sourceProjectId_targetYear_targetMonth: {
                    sourceProjectId: source.id,
                    targetYear: validated.targetYear,
                    targetMonth: validated.targetMonth,
                },
            }
            const marker = await tx.projectRollover.findUnique({ where: markerWhere })
            if (marker?.newProjectId) {
                const existingTarget = await tx.project.update({
                    where: { id: marker.newProjectId },
                    data: {
                        status: "Active",
                        closedAt: null,
                        closedMonthKey: null,
                        isHeavyRevenueMonth: false,
                    },
                    select: { id: true, siteId: true },
                })
                return { id: existingTarget.id, siteId: existingTarget.siteId, partnerId: source.site.partnerId, created: false }
            }

            const serviceIds = source.services.map((service) => service.id).sort()
            const sameMonthCandidates = await tx.project.findMany({
                where: {
                    siteId: source.siteId,
                    createdAt: { gte: targetDate, lt: targetEnd },
                    services: { some: { id: { in: serviceIds } } },
                },
                select: { id: true, siteId: true, services: { select: { id: true } } },
            })
            const existingTarget = sameMonthCandidates.find((candidate) => {
                const candidateServiceIds = candidate.services.map((service) => service.id).sort()
                return candidateServiceIds.length === serviceIds.length
                    && candidateServiceIds.every((id, index) => id === serviceIds[index])
            })

            if (existingTarget) {
                await tx.project.update({
                    where: { id: existingTarget.id },
                    data: {
                        status: "Active",
                        closedAt: null,
                        closedMonthKey: null,
                        isHeavyRevenueMonth: false,
                    },
                })
                await tx.projectRollover.upsert({
                    where: markerWhere,
                    create: {
                        sourceProjectId: source.id,
                        targetYear: validated.targetYear,
                        targetMonth: validated.targetMonth,
                        newProjectId: existingTarget.id,
                    },
                    update: { newProjectId: existingTarget.id },
                })
                return { id: existingTarget.id, siteId: existingTarget.siteId, partnerId: source.site.partnerId, created: false }
            }

            const uniqueTasks = Array.from(new Set(source.services.flatMap((service) => {
                try {
                    const parsed = JSON.parse(service.standardTasks)
                    return Array.isArray(parsed) ? parsed.map(String) : []
                } catch {
                    return []
                }
            }).map((taskName) => taskName.trim()).filter(Boolean)))
            const fee = resolveRecurringRolloverFee(source.recurringBaseFee, source.currentFee)
            const created = await tx.project.create({
                data: {
                    siteId: source.siteId,
                    name: formatProjectName({
                        siteName: source.site.domainName,
                        services: source.services,
                        createdAt: targetDate,
                    }),
                    services: { connect: serviceIds.map((id) => ({ id })) },
                    currentFee: fee,
                    recurringBaseFee: fee,
                    status: "Active",
                    paymentStatus: "Unpaid",
                    createdAt: targetDate,
                },
                select: { id: true, siteId: true },
            })
            if (uniqueTasks.length) {
                await tx.task.createMany({
                    data: uniqueTasks.map((name) => ({
                        projectId: created.id,
                        taskScope: "FREELANCE",
                        name,
                        status: "Active",
                    })),
                })
            }
            await tx.projectRollover.upsert({
                where: markerWhere,
                create: {
                    sourceProjectId: source.id,
                    targetYear: validated.targetYear,
                    targetMonth: validated.targetMonth,
                    newProjectId: created.id,
                },
                update: { newProjectId: created.id },
            })
            return { id: created.id, siteId: created.siteId, partnerId: source.site.partnerId, created: true }
        })

        await logSessionAuditEvent(session, {
            action: "PROJECT_RECURRING_REOPENED",
            details: `sourceProjectId=${validated.projectId}; targetProjectId=${result.id}; targetYear=${validated.targetYear}; targetMonth=${validated.targetMonth}; created=${result.created}`,
        })
        revalidateProjectPaths(result.id, result.partnerId, result.siteId)
        revalidateProjectPaths(validated.projectId)
        return { success: true as const, data: { projectId: result.id, created: result.created } }
    } catch (error) {
        return {
            success: false as const,
            error: getActionErrorMessage(error, "Failed to open recurring project"),
            code: error instanceof ActionError ? error.code : undefined,
        }
    }
}

export async function togglePaymentStatus(projectId: string, currentStatus: string) {
    try {
        const session = await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const validatedCurrentStatus = PaymentStatusSchema.parse(currentStatus)
        const newStatus = validatedCurrentStatus === "Paid" ? "Unpaid" : "Paid"

        const updated = await prisma.project.updateMany({
            where: { id: validatedProjectId },
            data: { paymentStatus: newStatus },
        })
        if (updated.count === 0) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_PAYMENT_TOGGLE_FAILED",
                success: false,
                details: `projectId=${validatedProjectId}; reason=not_found`,
            })
            return { success: false, error: "Project not found" }
        }

        await logSessionAuditEvent(session, {
            action: "PROJECT_PAYMENT_TOGGLED",
            details: `projectId=${validatedProjectId}; from=${validatedCurrentStatus}; to=${newStatus}`,
        })
        revalidatePath("/ledger")
        return { success: true }
    } catch (error) {
        return { success: false, error: getActionErrorMessage(error, "Failed to update payment status") }
    }
}

export async function setProjectPaymentState(input: {
    projectId: string
    expectedStatus: "Paid" | "Unpaid"
    nextStatus: "Paid" | "Unpaid"
    amount?: number
    paymentMethod?: string
}) {
    try {
        const session = await requireAuth()
        const validated = SetProjectPaymentStateSchema.parse(input)
        const paidAt = validated.nextStatus === "Paid" ? new Date() : null
        const paymentMethod = validated.paymentMethod
            ? normalizePaymentMethod(validated.paymentMethod)
            : undefined

        const result = await prisma.$transaction(async (tx) => {
            const project = await tx.project.findUnique({
                where: { id: validated.projectId },
                select: {
                    id: true,
                    currentFee: true,
                    paymentStatus: true,
                    site: { select: { id: true, partnerId: true } },
                },
            })
            if (!project) throw new ActionError("PROJECT_NOT_FOUND", "Project not found")
            if (project.paymentStatus !== validated.expectedStatus) {
                throw new ActionError("PAYMENT_STATE_CHANGED", "Payment status changed in another view. Refresh and try again.")
            }

            const amount = validated.nextStatus === "Paid" && validated.amount !== undefined
                ? validated.amount
                : Number(project.currentFee || 0)
            const updated = await tx.project.updateMany({
                where: { id: project.id, paymentStatus: validated.expectedStatus },
                data: {
                    paymentStatus: validated.nextStatus,
                    paidAt,
                    ...(validated.nextStatus === "Paid" && validated.amount !== undefined
                        ? { currentFee: validated.amount }
                        : {}),
                    ...(validated.nextStatus === "Paid" && paymentMethod
                        ? { paymentMethod }
                        : {}),
                },
            })
            if (updated.count !== 1) {
                throw new ActionError("PAYMENT_STATE_CHANGED", "Payment status changed in another view. Refresh and try again.")
            }
            return { project, amount }
        })

        await logSessionAuditEvent(session, {
            action: "PROJECT_PAYMENT_TOGGLED",
            details: `projectId=${validated.projectId}; from=${validated.expectedStatus}; to=${validated.nextStatus}; amount=${result.amount}; paidAt=${paidAt?.toISOString() || "none"}; paymentMethod=${paymentMethod || "unchanged"}`,
        })
        revalidateProjectPaths(validated.projectId, result.project.site.partnerId, result.project.site.id)
        revalidatePath("/payments")
        revalidatePath("/ledger")
        return {
            success: true as const,
            data: {
                id: validated.projectId,
                paymentStatus: validated.nextStatus,
                currentFee: result.amount,
                paidAt: paidAt?.toISOString() || null,
                paymentMethod: paymentMethod || null,
            },
        }
    } catch (error) {
        return {
            success: false as const,
            error: getActionErrorMessage(error, "Failed to update payment status"),
            code: error instanceof ActionError ? error.code : undefined,
        }
    }
}

export async function setProjectPaymentMethod(input: {
    projectId: string
    paymentMethod: string
}) {
    try {
        const session = await requireAuth()
        const projectId = z.string().uuid("Invalid project id").parse(input.projectId)
        const paymentMethod = normalizePaymentMethod(PaymentMethodSchema.parse(input.paymentMethod))
        const updated = await prisma.project.updateMany({
            where: { id: projectId, paymentStatus: "Paid" },
            data: { paymentMethod },
        })
        if (updated.count !== 1) {
            return { success: false as const, error: "Paid project not found" }
        }
        await logSessionAuditEvent(session, {
            action: "PROJECT_PAYMENT_METHOD_UPDATED",
            details: `projectId=${projectId}; paymentMethod=${paymentMethod}`,
        })
        revalidatePath("/payments")
        revalidatePath("/projects")
        return { success: true as const, data: { paymentMethod } }
    } catch (error) {
        return {
            success: false as const,
            error: getActionErrorMessage(error, "Failed to update payment method"),
        }
    }
}

export async function updateProject(projectId: string, data: {
    name?: string
    description?: string | null
    status?: string
    paymentStatus?: string
    paidAt?: Date | string | null
    closedAt?: Date | string | null
    isHeavyRevenueMonth?: boolean
    createdAt?: Date | string
    currentFee?: number | null
    serviceIds?: string[]
}, options?: {
    expectedDescription?: string | null
    notesWriteProtocol?: string
}) {
    try {
        const session = await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const updateData: Record<string, unknown> = {}
        if (data.name !== undefined) updateData.name = data.name === "" ? null : data.name
        if (data.description !== undefined) updateData.description = normalizeRichTextContent(data.description)
        if (data.status !== undefined) updateData.status = data.status
        if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
        if (data.paidAt !== undefined) updateData.paidAt = data.paidAt
        if (data.closedAt !== undefined) updateData.closedAt = data.closedAt
        if (data.isHeavyRevenueMonth !== undefined) updateData.isHeavyRevenueMonth = data.isHeavyRevenueMonth
        if (data.createdAt !== undefined) updateData.createdAt = data.createdAt
        if (data.currentFee !== undefined) updateData.currentFee = data.currentFee
        if (data.serviceIds !== undefined) updateData.serviceIds = data.serviceIds

        const validated = UpdateProjectSchema.parse(updateData)

        // serviceIds is handled through relation updates below and must not be passed as a scalar field.
        const { serviceIds, ...restValidated } = validated
        const prismaUpdateData: Prisma.ProjectUpdateInput = { ...restValidated }

        if (serviceIds) {
            const uniqueServiceIds = Array.from(new Set(serviceIds))
            const projectInfo = await prisma.project.findFirst({
                where: { id: validatedProjectId },
                include: { site: true }
            })

            const newServices = await prisma.service.findMany({
                where: { id: { in: uniqueServiceIds } }
            })
            if (newServices.length !== uniqueServiceIds.length) {
                await logSessionAuditEvent(session, {
                    action: "PROJECT_UPDATE_FAILED",
                    success: false,
                    details: `projectId=${validatedProjectId}; reason=service_scope_mismatch`,
                })
                return { success: false, error: "One or more services are inaccessible" }
            }

            if (projectInfo && projectInfo.site && newServices.length > 0) {
                prismaUpdateData.name = formatProjectName({
                    siteName: projectInfo.site.domainName,
                    services: newServices,
                    createdAt: projectInfo.createdAt || new Date(),
                })
            }

            prismaUpdateData.services = {
                set: uniqueServiceIds.map(id => ({ id }))
            }
        }

        const existingProject = await prisma.project.findFirst({
            where: { id: validatedProjectId },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                closedAt: true,
                closedMonthKey: true,
                isHeavyRevenueMonth: true,
                description: true,
            },
        })
        if (!existingProject) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_UPDATE_FAILED",
                success: false,
                details: `projectId=${validatedProjectId}; reason=not_found`,
            })
            return { success: false, error: "Project not found" }
        }

        if (
            data.description !== undefined
            && !hasCurrentNotesWriteProtocol(options?.notesWriteProtocol)
        ) {
            await logSessionAuditEvent(session, {
                action: "NOTE_WRITE_PROTOCOL_REJECTED",
                success: false,
                details: `projectId=${validatedProjectId}; reason=stale_notes_client`,
            })
            return {
                success: false,
                error: NOTES_CLIENT_REFRESH_MESSAGE,
                code: NOTES_CLIENT_REFRESH_REQUIRED,
            }
        }

        if (
            data.description !== undefined
            && options
            && Object.prototype.hasOwnProperty.call(options, "expectedDescription")
            && normalizeRichTextContent(existingProject.description) !== normalizeRichTextContent(options.expectedDescription)
        ) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_NOTE_UPDATE_CONFLICT",
                success: false,
                details: `projectId=${validatedProjectId}; reason=stale_description`,
            })
            return {
                success: false,
                error: "Project notes changed in another view. Reload before saving again.",
            }
        }

        if (
            validated.status !== "Closed" &&
            (validated.closedAt !== undefined || validated.isHeavyRevenueMonth !== undefined)
        ) {
            return {
                success: false,
                error: "Closure details can only be set when status is Closed",
            }
        }

        const isClosing = validated.status === "Closed"
        const isReopening =
            validated.status !== undefined &&
            validated.status !== "Closed" &&
            existingProject.status === "Closed"

        if (isClosing) {
            if (validated.closedAt === undefined || validated.closedAt === null) {
                return { success: false, error: "Please provide the project close date" }
            }
            if (validated.isHeavyRevenueMonth === undefined) {
                return { success: false, error: "Please specify heavy revenue for the close month" }
            }

            const parsedClosedAt =
                validated.closedAt instanceof Date
                    ? validated.closedAt
                    : parseClosureDateInput(validated.closedAt)

            if (Number.isNaN(parsedClosedAt.getTime())) {
                return { success: false, error: "Invalid close date" }
            }

            prismaUpdateData.closedAt = parsedClosedAt
            prismaUpdateData.closedMonthKey = format(parsedClosedAt, "yyyy-MM")
            prismaUpdateData.isHeavyRevenueMonth = validated.isHeavyRevenueMonth
        } else if (isReopening) {
            prismaUpdateData.closedAt = null
            prismaUpdateData.closedMonthKey = null
            prismaUpdateData.isHeavyRevenueMonth = false
        }

        const project = await prisma.project.update({
            where: { id: existingProject.id },
            data: prismaUpdateData,
            include: { site: true }
        })

        if (validated.status && validated.status !== existingProject.status) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_STATUS_CHANGED",
                details: `projectId=${validatedProjectId}; from=${existingProject.status}; to=${validated.status}; source=manual_update`,
            })
        }

        if (validated.status === "Closed" && project.closedAt) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_CLOSED",
                details: `projectId=${validatedProjectId}; closedAt=${project.closedAt.toISOString()}; closedMonth=${project.closedMonthKey || "n/a"}; heavyRevenue=${project.isHeavyRevenueMonth ? "yes" : "no"}; source=${existingProject.status === "Closed" ? "closure_update" : "manual_close"}`,
            })
        }

        if (isReopening) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_REOPENED",
                details: `projectId=${validatedProjectId}; previousClosedAt=${existingProject.closedAt?.toISOString() || "n/a"}; previousClosedMonth=${existingProject.closedMonthKey || "n/a"}`,
            })
        }

        if (validated.paymentStatus && validated.paymentStatus !== existingProject.paymentStatus) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_PAYMENT_TOGGLED",
                details: `projectId=${validatedProjectId}; from=${existingProject.paymentStatus}; to=${validated.paymentStatus}`,
            })
        }

        await logSessionAuditEvent(session, {
            action: "PROJECT_UPDATED",
            details: `projectId=${validatedProjectId}`,
        })
        revalidateProjectPaths(projectId, project.site.partnerId, project.siteId)
        return { success: true }
    } catch (error: unknown) {
        logger.error("project.update_failed", { projectId, error })
        return { success: false, error: getActionErrorMessage(error, "Failed to update project") }
    }
}

export async function deleteProject(projectId: string) {
    try {
        const session = await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const project = await prisma.project.findFirst({
            where: { id: validatedProjectId },
            include: { site: true }
        })
        if (!project) {
            await logSessionAuditEvent(session, {
                action: "PROJECT_DELETE_FAILED",
                success: false,
                details: `projectId=${validatedProjectId}; reason=not_found`,
            })
            return { success: false, error: "Project not found" }
        }
        const drawingPreviews = await prisma.noteDrawing.findMany({
            where: {
                OR: [
                    { projectId: project.id },
                    { task: { projectId: project.id } },
                ],
            },
            select: { previewPath: true },
        })
        await prisma.project.delete({ where: { id: project.id } })
        await Promise.all(drawingPreviews.map(({ previewPath }) => removeDrawingPreview(previewPath)))
        await logSessionAuditEvent(session, {
            action: "PROJECT_DELETED",
            details: `projectId=${project.id}`,
        })
        revalidateProjectPaths(projectId, project.site.partnerId, project.siteId)
        return { success: true }
    } catch (error) {
        console.error("Delete project failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete project") }
    }
}

export async function getProjectById(projectId: string) {
    try {
        await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)

        const project = await prisma.project.findFirst({
            where: { id: validatedProjectId },
            include: {
                services: true,
                site: {
                    include: {
                        partner: true,
                    },
                },
                timeLogs: true,
                tasks: {
                    include: {
                        timeLogs: true,
                    },
                },
                _count: {
                    select: { tasks: true },
                },
            },
        })

        if (!project) {
            return { success: false, error: "Project not found" }
        }

        return { success: true, data: project }
    } catch (error: unknown) {
        console.error("Get project failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to load project") }
    }
}

export async function deleteProjects(projectIds: string[]) {
    try {
        const session = await requireAuth()
        const validatedProjectIds = ProjectIdsSchema.parse(projectIds)
        if (validatedProjectIds.length === 0) return { success: true }

        const drawingPreviews = await prisma.noteDrawing.findMany({
            where: {
                OR: [
                    { projectId: { in: validatedProjectIds } },
                    { task: { projectId: { in: validatedProjectIds } } },
                ],
            },
            select: { previewPath: true },
        })

        const deleted = await prisma.project.deleteMany({
            where: {
                id: { in: validatedProjectIds },
            }
        })
        await Promise.all(drawingPreviews.map(({ previewPath }) => removeDrawingPreview(previewPath)))

        await logSessionAuditEvent(session, {
            action: "PROJECTS_BULK_DELETED",
            details: `requested=${validatedProjectIds.length}; deleted=${deleted.count}`,
        })
        revalidateProjectPaths()
        return { success: true }
    } catch (error) {
        console.error("Bulk delete projects failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to delete projects") }
    }
}

export async function getProjectDetails(projectId: string) {
    try {
        await requireAuth()
        const validatedProjectId = ProjectIdSchema.parse(projectId)
        const project = await prisma.project.findFirst({
            where: { id: validatedProjectId },
            include: {
                services: true,
                site: {
                    include: {
                        partner: true,
                    },
                },
                timeLogs: {
                    where: {
                        startTime: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }
                },
                tasks: {
                    include: {
                        timeLogs: true
                    },
                    orderBy: {
                        status: 'asc'
                    }
                }
            },
        })

        if (!project) return { success: false, error: "Project not found" }

        project.tasks.sort((a, b) => {
            const statusDiff = taskStatusSortOrder(a.status) - taskStatusSortOrder(b.status)
            if (statusDiff !== 0) return statusDiff
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        return { success: true, data: JSON.parse(JSON.stringify(project)) }
    } catch (error) {
        console.error("Get project details failed:", error)
        return { success: false, error: getActionErrorMessage(error, "Failed to fetch project details") }
    }
}
