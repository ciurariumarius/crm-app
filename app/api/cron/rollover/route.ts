import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { cleanupExpiredRateLimits } from '@/lib/rate-limit'
import { apiError, apiInternalError, apiMethodNotAllowed, apiOk } from '@/lib/api-response'
import { matchesBearerOrHeaderSecret } from '@/lib/http-auth'
import { formatProjectName } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) return false

    return matchesBearerOrHeaderSecret(request, cronSecret, 'x-cron-secret')
}

function currentPeriod(date: Date) {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
    }
}

async function rolloverProject(project: {
    id: string
    tenantId: string
    siteId: string
    name: string | null
    currentFee: Prisma.Decimal | null
    services: { id: string; serviceName: string; standardTasks: string; isRecurring: boolean }[]
    site: { domainName: string }
}, today: Date) {
    const period = currentPeriod(today)
    const markerWhere = {
        tenantId_sourceProjectId_targetYear_targetMonth: {
            tenantId: project.tenantId,
            sourceProjectId: project.id,
            targetYear: period.year,
            targetMonth: period.month,
        },
    }

    return prisma.$transaction(async (tx) => {
        const existingMarker = await tx.projectRollover.findUnique({ where: markerWhere })

        if (existingMarker?.newProjectId) {
            return {
                status: 'skipped' as const,
                oldProjectId: project.id,
                oldProjectName: project.name,
                reason: 'already_processed',
                newProjectId: existingMarker.newProjectId,
            }
        }

        if (!existingMarker) {
            await tx.projectRollover.create({
                data: {
                    tenantId: project.tenantId,
                    sourceProjectId: project.id,
                    targetYear: period.year,
                    targetMonth: period.month,
                },
            })
        }

        const updated = await tx.project.updateMany({
            where: {
                id: project.id,
                tenantId: project.tenantId,
                status: {
                    in: ['Active', 'Completed'],
                },
            },
            data: { status: 'Completed' },
        })

        if (updated.count === 0) {
            return {
                status: 'skipped' as const,
                oldProjectId: project.id,
                oldProjectName: project.name,
                reason: 'source_not_rollover_eligible',
            }
        }

        const serviceIds = project.services.map((service) => service.id)
        const currentFee = project.currentFee ? Number(project.currentFee) : 0
        const newProjectName = formatProjectName({
            siteName: project.site.domainName,
            services: project.services,
            createdAt: today,
        })

        const allStandardTasks = project.services.flatMap((service) => {
            try {
                const parsed = JSON.parse(service.standardTasks)
                return Array.isArray(parsed) ? parsed : []
            } catch {
                return []
            }
        })

        const uniqueTasks = Array.from(new Set(allStandardTasks)).map((taskName) => String(taskName).trim()).filter(Boolean)

        const createdProject = await tx.project.create({
            data: {
                tenantId: project.tenantId,
                siteId: project.siteId,
                name: newProjectName,
                services: {
                    connect: serviceIds.map((id) => ({ id })),
                },
                currentFee,
                status: 'Active',
                paymentStatus: 'Unpaid',
            },
        })

        if (uniqueTasks.length > 0) {
            await tx.task.createMany({
                data: uniqueTasks.map((taskName) => ({
                    tenantId: project.tenantId,
                    projectId: createdProject.id,
                    name: taskName,
                    status: 'Active',
                })),
            })
        }

        await tx.projectRollover.update({
            where: markerWhere,
            data: {
                newProjectId: createdProject.id,
            },
        })

        return {
            status: 'created' as const,
            oldProjectId: project.id,
            oldProjectName: project.name,
            newProjectId: createdProject.id,
        }
    })
}

export async function POST(request: Request) {
    if (!isAuthorized(request)) {
        return apiError('Unauthorized', 401, { code: 'CRON_UNAUTHORIZED' })
    }

    try {
        const today = new Date()
        const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)

        const projectsToRollover = await prisma.project.findMany({
            where: {
                status: {
                    in: ['Active', 'Completed'],
                },
                createdAt: { lt: startOfCurrentMonth },
                services: {
                    some: { isRecurring: true },
                },
            },
            select: {
                id: true,
                tenantId: true,
                siteId: true,
                name: true,
                currentFee: true,
                site: { select: { domainName: true } },
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

        if (projectsToRollover.length === 0) {
            return apiOk({
                success: true,
                message: 'No projects to rollover',
                processed: 0,
                created: 0,
                skipped: 0,
                failed: 0,
                details: [],
            })
        }

        const details: Array<Record<string, unknown>> = []

        for (const project of projectsToRollover) {
            try {
                const result = await rolloverProject(project, today)
                details.push(result)
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    details.push({
                        status: 'skipped',
                        oldProjectId: project.id,
                        oldProjectName: project.name,
                        reason: 'duplicate_rollover_marker',
                    })
                    continue
                }

                details.push({
                    status: 'failed',
                    oldProjectId: project.id,
                    oldProjectName: project.name,
                    reason: 'exception',
                })
            }
        }

        const created = details.filter((entry) => entry.status === 'created').length
        const skipped = details.filter((entry) => entry.status === 'skipped').length
        const failed = details.filter((entry) => entry.status === 'failed').length

        // Operational hygiene tasks that can run opportunistically with cron.
        await cleanupExpiredRateLimits().catch(() => undefined)

        return apiOk({
            success: true,
            processed: projectsToRollover.length,
            created,
            skipped,
            failed,
            details,
        })
    } catch (error) {
        return apiInternalError(error)
    }
}

export async function GET() {
    return apiMethodNotAllowed(['POST'])
}
