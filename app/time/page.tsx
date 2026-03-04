import { TimeLogsFilters } from "@/components/time/time-logs-filters"
import { formatProjectName } from "@/lib/utils"
import { TimeLogsTable } from "@/components/time/time-logs-table"
import { getTimeLogs } from "@/lib/actions/time"
import prisma from "@/lib/prisma"
import { CreateTimeLogDialog } from "@/components/time/create-time-log-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { requireTenantContext } from "@/lib/tenant"
import Link from "next/link"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

export default async function TimePage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string }>
}) {
    const session = await requireTenantContext()
    const { projectId, partnerId, q, page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)

    const [projects, partners, tasks, logsResult] = await Promise.all([
        prisma.project.findMany({
            where: { status: "Active", tenantId: session.tenantId },
            include: {
                site: { select: { domainName: true, partnerId: true } },
                services: true
            }
        }),
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
            select: { id: true, name: true }
        }),
        prisma.task.findMany({
            where: { status: { not: "Completed" }, tenantId: session.tenantId },
            select: { id: true, name: true, projectId: true }
        }),
        getTimeLogs({
            projectId,
            partnerId,
            q,
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
        })
    ])

    const formattedProjects = projects.map(p => {
        return {
            id: p.id,
            siteName: formatProjectName(p),
            displayName: formatProjectName(p),
            site: p.site,
            services: p.services
        }
    })

    const logs = logsResult.success && logsResult.data ? logsResult.data : []
    const totalLogs = logsResult.success ? logsResult.total ?? logs.length : 0

    // Ensure logs match the expected type or cast appropriately if strict match is complex
    const formattedLogs = logs?.map(log => ({
        ...log,
    }))

    // Serialization for client component
    const serializedLogs = JSON.parse(JSON.stringify(logs))

    const totalTimeSeconds = logs?.reduce((sum, log) => sum + (log.durationSeconds || 0), 0) || 0
    const totalHours = (totalTimeSeconds / 3600).toFixed(1)
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (projectId) next.set("projectId", projectId)
        if (partnerId) next.set("partnerId", partnerId)
        if (q) next.set("q", q)
        next.set("page", String(targetPage))
        return `/time?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Time Logs"
                actions={(
                    <CreateTimeLogDialog
                        projects={formattedProjects}
                        tasks={tasks}
                    />
                )}
            />

            <div className="flex flex-col gap-6">
                <TimeLogsFilters
                    partners={partners}
                    projects={formattedProjects}
                />

                <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-6">
                    <TimeLogsTable
                        logs={serializedLogs}
                        projects={formattedProjects}
                        tasks={tasks}
                    />

                    <div className="mt-6 pt-4 border-t border-border flex justify-between items-center px-2">
                        <span className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Total Hours (Filtered)</span>
                        <span className="font-mono font-bold text-lg text-primary">{totalHours}h</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Page {page} of {totalPages} · {totalLogs} logs</span>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(prevPage)}>
                                    Previous
                                </Link>
                            ) : (
                                <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Previous</span>
                            )}
                            {nextPage ? (
                                <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(nextPage)}>
                                    Next
                                </Link>
                            ) : (
                                <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Next</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
