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
                    totalLogs={totalLogs}
                />

                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-md transition-all">
                    <TimeLogsTable
                        logs={serializedLogs}
                        projects={formattedProjects}
                        tasks={tasks}
                    />

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <span>Page {page} of {totalPages}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-200" />
                                <span>{totalLogs} logs</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200" />
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <span className="text-slate-500">Total Hours:</span>
                                <span className="font-mono text-primary text-sm">{totalHours}h</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                                >
                                    Previous
                                </Link>
                            ) : (
                                <span className="inline-flex h-9 items-center rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                                    Previous
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    href={buildPageHref(nextPage)}
                                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                                >
                                    Next
                                </Link>
                            ) : (
                                <span className="inline-flex h-9 items-center rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                                    Next
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
