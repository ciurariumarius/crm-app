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

function isBeforeMonthStart(date: Date, startOfCurrentMonth: Date) {
    return date.getTime() < startOfCurrentMonth.getTime()
}

async function buildRolloverDebugSnapshot(startOfCurrentMonth: Date) {
    const projects = await prisma.project.findMany({
        select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            site: { select: { domainName: true } },
            services: { select: { serviceName: true, isRecurring: true } },
        },
    })

    const recurringProjectsList = projects.filter((project) => project.services.some((service) => service.isRecurring))
    const recurringOlderProjects = recurringProjectsList.filter((project) => isBeforeMonthStart(project.createdAt, startOfCurrentMonth))
    const recurringOlderSamples = recurringOlderProjects
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)

    const totalProjects = projects.length
    const activeProjects = projects.filter((project) => project.status === 'Active').length
    const recurringProjects = recurringProjectsList.length
    const recurringActiveOlderThanCurrentMonth = recurringOlderProjects.filter((project) => project.status === 'Active').length
    const recurringNotActiveOlderThanCurrentMonth = recurringOlderProjects.filter((project) => project.status !== 'Active').length
    const activeOlderThanCurrentMonthWithoutRecurring = projects.filter((project) => (
        project.status === 'Active'
        && isBeforeMonthStart(project.createdAt, startOfCurrentMonth)
        && project.services.every((service) => !service.isRecurring)
    )).length

    return {
        now: new Date().toISOString(),
        startOfCurrentMonth: startOfCurrentMonth.toISOString(),
        counters: {
            totalProjects,
            activeProjects,
            recurringProjects,
            recurringActiveOlderThanCurrentMonth,
            recurringNotActiveOlderThanCurrentMonth,
            activeOlderThanCurrentMonthWithoutRecurring,
        },
        recurringOlderSamples: recurringOlderSamples.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
            domain: project.site.domainName,
            services: project.services.map((service) => ({
                serviceName: service.serviceName,
                isRecurring: service.isRecurring,
            })),
        })),
    }
}

async function rolloverProject(project: {
    id: string
    siteId: string
    name: string | null
    currentFee: Prisma.Decimal | null
    services: { id: string; serviceName: string; standardTasks: string; isRecurring: boolean }[]
    site: { domainName: string }
}, today: Date) {
    const period = currentPeriod(today)
    const markerWhere = {
        sourceProjectId_targetYear_targetMonth: {
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
                    sourceProjectId: project.id,
                    targetYear: period.year,
                    targetMonth: period.month,
                },
            })
        }

        const updated = await tx.project.updateMany({
            where: {
                id: project.id,
                status: 'Active',
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

        await tx.auditLog.create({
            data: {
                action: 'PROJECT_STATUS_CHANGED',
                details: `projectId=${project.id}; from=Active; to=Completed; source=rollover_cron`,
            },
        })

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
        const { searchParams } = new URL(request.url)
        const debug = searchParams.get('debug') === '1'
        const dryRun = searchParams.get('dryRun') === '1'
        const today = new Date()
        const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const debugSnapshot = debug ? await buildRolloverDebugSnapshot(startOfCurrentMonth) : undefined

        const activeRecurringProjects = await prisma.project.findMany({
            where: {
                status: 'Active',
                services: {
                    some: { isRecurring: true },
                },
            },
            select: {
                id: true,
                siteId: true,
                name: true,
                createdAt: true,
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
        const projectsToRollover = activeRecurringProjects.filter((project) => (
            isBeforeMonthStart(project.createdAt, startOfCurrentMonth)
        ))

        if (dryRun) {
            return apiOk({
                success: true,
                dryRun: true,
                message: projectsToRollover.length === 0 ? 'No projects would rollover' : 'Dry run complete',
                processed: projectsToRollover.length,
                created: 0,
                skipped: 0,
                failed: 0,
                details: projectsToRollover.map((project) => ({
                    status: 'dry_run_would_rollover',
                    oldProjectId: project.id,
                    oldProjectName: project.name,
                })),
                ...(debugSnapshot ? { debug: debugSnapshot } : {}),
            })
        }

        if (projectsToRollover.length === 0) {
            return apiOk({
                success: true,
                message: 'No projects to rollover',
                processed: 0,
                created: 0,
                skipped: 0,
                failed: 0,
                details: [],
                ...(debugSnapshot ? { debug: debugSnapshot } : {}),
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
            ...(debugSnapshot ? { debug: debugSnapshot } : {}),
        })
    } catch (error) {
        return apiInternalError(error)
    }
}

export async function GET() {
    return apiMethodNotAllowed(['POST'])
}
