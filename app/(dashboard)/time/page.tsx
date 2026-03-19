import { TimeLogsFilters } from "@/components/time/time-logs-filters"
import { formatProjectName } from "@/lib/utils"
import { TimeLogsTable } from "@/components/time/time-logs-table"
import { getTimeLogs } from "@/lib/actions/time"
import prisma from "@/lib/prisma"
import { CreateTimeLogDialog } from "@/components/time/create-time-log-dialog"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { requireTenantContext } from "@/lib/tenant"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonLinkClassName } from "@/components/ui/button-link"
import { FilterBarDivider } from "@/components/ui/filter-bar"

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
            <DashboardPageHeader
                title="Time Logs"
                showMobile
                actions={(
                    <CreateTimeLogDialog
                        projects={formattedProjects}
                        tasks={tasks}
                    />
                )}
            />

            <div className="space-y-6">
                <TimeLogsFilters
                    partners={partners}
                    projects={formattedProjects}
                    totalLogs={totalLogs}
                />

                <TimeLogsTable
                    logs={serializedLogs}
                    projects={formattedProjects}
                    tasks={tasks}
                />

                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/50 mt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 ui-overline">
                            <span>Page {page} of {totalPages}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-200" />
                            <span>{totalLogs} logs</span>
                        </div>
                        <FilterBarDivider className="h-4" />
                        <div className="flex items-center gap-2 ui-overline">
                            <span>Total Hours:</span>
                            <span className="font-mono text-primary text-sm font-bold tracking-tight">{totalHours}h</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild={!!prevPage}
                            disabled={!prevPage}
                            className={cn(
                                buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-10 px-4 rounded-xl ui-text-caption" }),
                                !prevPage ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {prevPage ? (
                                <Link href={buildPageHref(prevPage)} className="flex items-center gap-2">
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Link>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </span>
                            )}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            asChild={!!nextPage}
                            disabled={!nextPage}
                            className={cn(
                                buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-10 px-4 rounded-xl ui-text-caption" }),
                                !nextPage ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {nextPage ? (
                                <Link href={buildPageHref(nextPage)} className="flex items-center gap-2">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className="flex items-center gap-2">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
