import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react"
import prisma from "@/lib/prisma"
import { cn, formatProjectName } from "@/lib/utils"
import { requireAuth } from "@/lib/auth"
import { getActiveTimer, getTimeLogs } from "@/lib/actions/time"
import { TimeLogsTable } from "@/components/time/time-logs-table"
import { CreateTimeLogDialog } from "@/components/time/create-time-log-dialog"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { buttonLinkClassName } from "@/components/ui/button-link"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 50
const SORT_FIELDS = ["startTime", "partner", "project", "task", "description", "duration", "source", "status"] as const

function parseDateFilter(value: string | undefined, endOfDay = false) {
    if (!value) return undefined
    const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
    return Number.isNaN(date.getTime()) ? undefined : date
}

function parseMinutes(value: string | undefined) {
    if (!value) return undefined
    const minutes = Number(value)
    return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes * 60) : undefined
}

type TimeSearchParams = {
    projectId?: string
    partnerId?: string
    taskQ?: string
    descriptionQ?: string
    source?: "MANUAL" | "TIMER"
    status?: "running" | "completed"
    from?: string
    to?: string
    minDuration?: string
    maxDuration?: string
    sort?: string
    order?: "asc" | "desc"
    page?: string
}

export default async function TimePage({ searchParams }: { searchParams: Promise<TimeSearchParams> }) {
    await requireAuth()
    const params = await searchParams
    const sort = SORT_FIELDS.includes(params.sort as (typeof SORT_FIELDS)[number]) ? params.sort as (typeof SORT_FIELDS)[number] : "startTime"
    const order = params.order === "asc" ? "asc" : "desc"
    const page = Math.max(1, Number(params.page) || 1)

    const [activeProjectsRaw, projectOptionsRaw, partners, tasks, logsResult, activeTimerResult] = await Promise.all([
        prisma.project.findMany({
            where: { status: "Active" },
            include: {
                site: { select: { domainName: true, partnerId: true } },
                services: true,
            },
        }),
        prisma.project.findMany({
            select: {
                id: true,
                name: true,
                site: { select: { domainName: true } },
                services: { select: { serviceName: true, isRecurring: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.task.findMany({
            where: { status: { not: "Completed" } },
            select: { id: true, name: true, projectId: true },
        }),
        getTimeLogs({
            projectId: params.projectId,
            partnerId: params.partnerId,
            taskQ: params.taskQ,
            descriptionQ: params.descriptionQ,
            source: params.source,
            status: params.status,
            from: parseDateFilter(params.from),
            to: parseDateFilter(params.to, true),
            minDurationSeconds: parseMinutes(params.minDuration),
            maxDurationSeconds: parseMinutes(params.maxDuration),
            sort,
            order,
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
        }),
        getActiveTimer(),
    ])

    const activeProjects = activeProjectsRaw.map((project) => ({
        id: project.id,
        siteName: formatProjectName(project),
        displayName: formatProjectName(project),
        site: project.site,
        services: project.services,
    }))
    const projectOptions = projectOptionsRaw.map((project) => ({ id: project.id, displayName: formatProjectName(project) }))
    const tasksForTime = tasks
        .filter((task): task is { id: string; name: string; projectId: string } => Boolean(task.projectId))
        .map((task) => ({ id: task.id, name: task.name, projectId: task.projectId }))
    const logs = logsResult.success && logsResult.data ? logsResult.data : []
    const totalLogs = logsResult.success ? logsResult.total ?? logs.length : 0
    const totalHours = ((logsResult.success ? logsResult.totalDurationSeconds || 0 : 0) / 3600).toFixed(1)
    const serializedLogs = JSON.parse(JSON.stringify(logs))
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
    const activeTimer = activeTimerResult.success && activeTimerResult.status === "running" ? activeTimerResult.data : null
    const activeTimerStartedAt = activeTimer?.startTime ? new Date(activeTimer.startTime).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : null
    const activeTimerProjectName = activeTimer?.project ? formatProjectName(activeTimer.project) : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            if (key !== "page" && value) next.set(key, value)
        }
        next.set("page", String(targetPage))
        return `/time?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-6 pb-8 sm:gap-8">
            <AppPageHeader
                title="Time Logs"
                primaryAction={<CreateTimeLogDialog projects={activeProjects} tasks={tasksForTime} label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7" />}
                mobilePrimaryAction={<CreateTimeLogDialog projects={activeProjects} tasks={tasksForTime} label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7" />}
            />

            <div className="space-y-5">
                {activeTimer ? (
                    <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--brand-primary)_20%,var(--line-subtle))] bg-[var(--sidebar-accent)] px-4 py-3 shadow-[var(--shadow-apple)]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /><p className="ui-overline !text-emerald-700">Active timer running</p></div>
                                <p className="mt-1 truncate text-sm font-semibold text-emerald-900">{activeTimer.task?.name || activeTimer.description || "Active session"}</p>
                                {activeTimerProjectName ? <p className="truncate text-xs font-medium text-emerald-800/90">{activeTimerProjectName}</p> : null}
                            </div>
                            <div className="flex items-center gap-2 md:justify-end">
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-[var(--surface-lowest)]/70 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Clock3 className="h-3.5 w-3.5" />Started {activeTimerStartedAt || "now"}</span>
                                <Link href={activeTimer.projectId ? `/time?projectId=${activeTimer.projectId}` : "/time"} className={buttonLinkClassName({ size: "sm", variant: "activeBlue", className: "h-8 rounded-lg px-3 text-xs" })}>Show active</Link>
                            </div>
                        </div>
                    </div>
                ) : null}

                <TimeLogsTable
                    logs={serializedLogs}
                    projects={projectOptions}
                    tasks={tasksForTime}
                    partners={partners}
                    totalLogs={totalLogs}
                    currentSort={sort}
                    currentOrder={order}
                    filters={{
                        projectId: params.projectId || "all",
                        partnerId: params.partnerId || "all",
                        taskQ: params.taskQ || "",
                        descriptionQ: params.descriptionQ || "",
                        source: params.source || "all",
                        status: params.status || "all",
                        from: params.from || "",
                        to: params.to || "",
                        minDuration: params.minDuration || "",
                        maxDuration: params.maxDuration || "",
                    }}
                />

                <div className="flex items-center justify-between rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-3 py-2 shadow-[var(--shadow-apple)] sm:px-4">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">{page}/{totalPages}</span>
                        <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">{totalLogs} rows</span>
                        <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">{totalHours}h</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {page > 1 ? <Link href={buildPageHref(page - 1)} className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link> : <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" }), "cursor-not-allowed opacity-40")}><ChevronLeft className="h-4 w-4" /></span>}
                        {page < totalPages ? <Link href={buildPageHref(page + 1)} className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link> : <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" }), "cursor-not-allowed opacity-40")}><ChevronRight className="h-4 w-4" /></span>}
                    </div>
                </div>
            </div>
        </div>
    )
}
