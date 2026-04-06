import { TimeLogsFilters } from "@/components/time/time-logs-filters"
import { formatProjectName } from "@/lib/utils"
import { TimeLogsTable } from "@/components/time/time-logs-table"
import { getActiveTimer, getTimeLogs } from "@/lib/actions/time"
import prisma from "@/lib/prisma"
import { CreateTimeLogDialog } from "@/components/time/create-time-log-dialog"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { requireTenantContext } from "@/lib/tenant"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react"
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

    const [projects, partners, tasks, logsResult, activeTimerResult] = await Promise.all([
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
        }),
        getActiveTimer()
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
    const activeTimer = activeTimerResult.success && activeTimerResult.status === "running" ? activeTimerResult.data : null
    const activeTimerStartedAt = activeTimer?.startTime
        ? new Date(activeTimer.startTime).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
        : null
    const activeTimerProjectName = activeTimer?.project ? formatProjectName(activeTimer.project) : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (projectId) next.set("projectId", projectId)
        if (partnerId) next.set("partnerId", partnerId)
        if (q) next.set("q", q)
        next.set("page", String(targetPage))
        return `/time?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-6 pb-8 sm:gap-8">
            <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Time Logs"
                    eyebrow="Time Workspace"
                    subtitle="Review tracked sessions, active timers, and logged work across your delivery history."
                    showMobile
                    actions={(
                        <CreateTimeLogDialog
                            projects={formattedProjects}
                            tasks={tasks}
                        />
                    )}
                />
            </div>

            <div className="space-y-6">
                {activeTimer && (
                    <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(236,253,245,0.78),rgba(220,252,231,0.52))] px-4 py-4 shadow-[0_6px_18px_rgba(16,185,129,0.05)] sm:px-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="ui-overline !text-emerald-700">Active timer running</p>
                                </div>
                                <p className="mt-1 truncate text-sm font-semibold text-emerald-900">
                                    {activeTimer.task?.name || activeTimer.description || "Active session"}
                                </p>
                                {activeTimerProjectName && (
                                    <p className="truncate text-[12px] font-medium text-emerald-800/90">
                                        {activeTimerProjectName}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 md:justify-end">
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white/70 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Started {activeTimerStartedAt || "now"}
                                </span>
                                <Link
                                    href={activeTimer.projectId ? `/time?projectId=${activeTimer.projectId}` : "/time"}
                                    className={buttonLinkClassName({
                                        size: "sm",
                                        variant: "activeBlue",
                                        className: "h-8 rounded-lg px-3 text-[12px]"
                                    })}
                                >
                                    Show active
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

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

                <div className="mt-4 flex items-center justify-between rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.03)] sm:px-6 sm:py-4">
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
