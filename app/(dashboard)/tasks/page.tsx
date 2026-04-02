import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import { TasksSearchProvider } from "@/components/tasks/tasks-search-context"
import { TasksPaginationBar } from "@/components/tasks/tasks-pagination-bar"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { ListChecks, Play, AlertTriangle, CalendarClock, CalendarDays } from "lucide-react"
import { requireTenantContext } from "@/lib/tenant"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "@/lib/filters/task-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE_OPTIONS = [100, 250, 500] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGE_SIZE_VALUES = new Set<number>(PAGE_SIZE_OPTIONS)
const PAGINATION_THRESHOLD = 200
const SORT_OPTIONS = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Updated", value: "updated" },
    { label: "Name A-Z", value: "name_asc" },
    { label: "Name Z-A", value: "name_desc" },
] as const
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value))
const COL_VALUES = new Set(["3", "4"])

function buildSort(sort: string): Prisma.TaskOrderByWithRelationInput[] {
    switch (sort) {
        case "oldest":
            return [{ createdAt: "asc" }]
        case "updated":
            return [{ updatedAt: "desc" }]
        case "name_asc":
            return [{ name: "asc" }]
        case "name_desc":
            return [{ name: "desc" }]
        case "newest":
        default:
            return [{ createdAt: "desc" }]
    }
}

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string
        status?: string
        partnerId?: string
        projectId?: string
        urgency?: string
        overdue?: string
        dueToday?: string
        sort?: string
        perPage?: string
        page?: string
        cols?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const normalizedFilters = normalizeTaskFilters({
        q: params.q,
        status: params.status,
        partnerId: params.partnerId,
        projectId: params.projectId,
        urgency: params.urgency,
        overdue: params.overdue,
        dueToday: params.dueToday,
    })
    const q = normalizedFilters.q
    const statusFilter = normalizedFilters.status
    const partnerId = normalizedFilters.partnerId
    const projectId = normalizedFilters.projectId
    const urgencyFilter = normalizedFilters.urgency
    const dueTodayOnly = normalizedFilters.dueTodayOnly
    const overdueOnly = normalizedFilters.overdueOnly
    const sortRaw = params.sort || "newest"
    const sort = SORT_VALUES.has(sortRaw as (typeof SORT_OPTIONS)[number]["value"]) ? sortRaw : "newest"
    const colsRaw = params.cols || "3"
    const cols = COL_VALUES.has(colsRaw) ? Number(colsRaw) : 3
    const perPageRaw = Number(params.perPage)
    const perPage = PAGE_SIZE_VALUES.has(perPageRaw) ? perPageRaw : DEFAULT_PAGE_SIZE
    const view = "grid" as const
    const requestedPage = Math.max(1, Number(params.page) || 1)
    const { todayStart, todayEnd } = getLocalDayBounds(new Date())
    const where = buildTaskWhereInput({
        tenantId: session.tenantId,
        filters: normalizedFilters,
        todayStart,
        todayEnd,
    })

    const totalTasks = await prisma.task.count({ where })
    const shouldPaginate = totalTasks > PAGINATION_THRESHOLD
    const page = shouldPaginate ? requestedPage : 1

    const [tasksRaw, totalTasksOverall, totalActiveTasks, urgentTasksCount, overdueTasksCount, dueTodayTasksCount, allServicesRaw, activeTimerRaw, allProjectsRaw, userRaw] = await Promise.all([
        prisma.task.findMany({
            where,
            include: {
                project: {
                    include: {
                        services: true,
                        site: {
                            include: {
                                partner: true,
                            },
                        },
                    },
                },
                timeLogs: true,
            },
            orderBy: buildSort(sort),
            ...(shouldPaginate ? { skip: (page - 1) * perPage, take: perPage } : {}),
        }),
        prisma.task.count({
            where: { tenantId: session.tenantId },
        }),
        prisma.task.count({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
            },
        }),
        prisma.task.count({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                urgency: { in: ["Urgent", "High"] },
            },
        }),
        prisma.task.count({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                deadline: { not: null, lt: todayStart },
            },
        }),
        prisma.task.count({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                deadline: { not: null, gte: todayStart, lte: todayEnd },
            },
        }),
        prisma.service.findMany({ where: { tenantId: session.tenantId }, orderBy: { serviceName: "asc" } }),
        prisma.timeLog.findFirst({
            where: { endTime: null, tenantId: session.tenantId },
            include: { task: true, project: true },
        }),
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            select: {
                id: true,
                name: true,
                status: true,
                site: {
                    select: {
                        domainName: true,
                        partner: { select: { id: true, name: true } },
                    },
                },
                services: { select: { serviceName: true, isRecurring: true } },
                createdAt: true,
            },
            orderBy: { updatedAt: "desc" },
        }),
        prisma.user.findFirst({
            where: { id: session.userId, tenantId: session.tenantId },
            select: { hourlyRate: true },
        }),
    ])

    const normalizedTasksRaw = tasksRaw.map((task) => ({
        ...task,
        status: normalizeTaskStatus(task.status),
        urgency: normalizeTaskUrgency(task.urgency),
    }))
    const normalizedProjectsRaw = allProjectsRaw.map((project) => ({
        ...project,
        status: normalizeProjectStatus(project.status),
    }))

    const allServices = JSON.parse(JSON.stringify(allServicesRaw))
    const initialActiveTimer = JSON.parse(JSON.stringify(activeTimerRaw))
    const activeProjects = JSON.parse(JSON.stringify(normalizedProjectsRaw))
    const hourlyRate = Number((userRaw as { hourlyRate?: number | string | null } | null)?.hourlyRate || 0)

    const serializedTasks = JSON.parse(JSON.stringify(normalizedTasksRaw))
    const projectsList = normalizedProjectsRaw
        .map((project) => ({ id: project.id, name: formatProjectName(project) }))
        .sort((a, b) => a.name.localeCompare(b.name))

    const partnersMap = new Map()
    normalizedProjectsRaw.forEach((p) => {
        if (p.site?.partner) {
            partnersMap.set(p.site.partner.id, { id: p.site.partner.id, name: p.site.partner.name })
        }
    })
    const partnersList = Array.from(partnersMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    const totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalTasks / perPage)) : 1
    const prevPage = shouldPaginate && page > 1 ? page - 1 : null
    const nextPage = shouldPaginate && page < totalPages ? page + 1 : null
    const pageStart = totalTasks === 0 ? 0 : (page - 1) * perPage + 1
    const pageEnd = shouldPaginate ? Math.min(page * perPage, totalTasks) : totalTasks
    const buildTasksHref = (overrides: Record<string, string | null | undefined> = {}) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (statusFilter) next.set("status", statusFilter)
        if (partnerId) next.set("partnerId", partnerId)
        if (projectId) next.set("projectId", projectId)
        if (urgencyFilter) next.set("urgency", urgencyFilter)
        if (overdueOnly) next.set("overdue", "1")
        if (dueTodayOnly) next.set("dueToday", "1")
        if (sort && sort !== "newest") next.set("sort", sort)
        if (cols !== 3) next.set("cols", String(cols))
        if (perPage !== DEFAULT_PAGE_SIZE) next.set("perPage", String(perPage))
        if (shouldPaginate) {
            next.set("page", String(page))
        }

        for (const [key, value] of Object.entries(overrides)) {
            if (
                value === null ||
                value === undefined ||
                value === "" ||
                (key === "sort" && value === "newest") ||
                (key === "cols" && Number(value) === 3) ||
                (key === "perPage" && Number(value) === DEFAULT_PAGE_SIZE)
            ) {
                next.delete(key)
            } else {
                next.set(key, value)
            }
        }

        if (shouldPaginate && !next.get("page")) {
            next.set("page", "1")
        }
        if (!shouldPaginate) {
            next.delete("page")
        }

        return `/tasks?${next.toString()}`
    }
    const renderTasksSummaryRow = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Link
                href={buildTasksHref({ q: null, status: "All", urgency: "all", overdue: null, dueToday: null, projectId: null, partnerId: null, page: "1" })}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-inner">
                        <ListChecks className="h-4 w-4" />
                    </div>
                    <p className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-lg font-bold tracking-tight text-slate-900">{totalTasksOverall}</span>
                        <span className="text-[12px] font-semibold text-slate-500">Total</span>
                    </p>
                </div>
            </Link>

            <Link
                href={buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: null, dueToday: null, projectId: null, partnerId: null, page: "1" })}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-inner">
                        <Play className="h-4 w-4 fill-current" />
                    </div>
                    <p className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-lg font-bold tracking-tight text-slate-900">{totalActiveTasks}</span>
                        <span className="text-[12px] font-semibold text-slate-500">Active</span>
                    </p>
                </div>
            </Link>

            <Link
                href={buildTasksHref({ q: null, status: "Active", urgency: "Urgent", overdue: null, dueToday: null, projectId: null, partnerId: null, page: "1" })}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shadow-inner">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <p className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-lg font-bold tracking-tight text-slate-900">{urgentTasksCount}</span>
                        <span className="text-[12px] font-semibold text-slate-500">Urgent</span>
                    </p>
                </div>
            </Link>

            <Link
                href={buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: "1", dueToday: null, projectId: null, partnerId: null, page: "1" })}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100 shadow-inner">
                        <CalendarClock className="h-4 w-4" />
                    </div>
                    <p className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-lg font-bold tracking-tight text-slate-900">{overdueTasksCount}</span>
                        <span className="text-[12px] font-semibold text-slate-500">Overdue</span>
                    </p>
                </div>
            </Link>

            <Link
                href={buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: null, dueToday: "1", projectId: null, partnerId: null, page: "1" })}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md transition-all hover:shadow-md"
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-inner">
                        <CalendarDays className="h-4 w-4" />
                    </div>
                    <p className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-lg font-bold tracking-tight text-slate-900">{dueTodayTasksCount}</span>
                        <span className="text-[12px] font-semibold text-slate-500">Due Today</span>
                    </p>
                </div>
            </Link>
        </div>
    )

    const renderPaginationBar = () => (
        <TasksPaginationBar
            fallback={{
                total: totalTasks,
                page,
                perPage,
                totalPages,
                pageStart,
                pageEnd,
                shouldPaginate,
                prevPage,
                nextPage,
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            defaultPageSize={DEFAULT_PAGE_SIZE}
        />
    )

    return (
        <TasksSearchProvider initialSearch={q || ""}>
            <div className="flex flex-col gap-4">
                <DashboardPageHeader
                    title="Tasks"
                    showMobile
                    search={<TasksSearchInput />}
                    mobileSearch={<TasksSearchInput />}
                    mobileActions={
                        <CreateTaskButton
                            projects={activeProjects}
                            label="Add Task"
                            showLabelOnMobile
                            className="!h-12 !w-auto !min-w-[148px] !rounded-2xl !px-4 !gap-2 !text-white"
                        />
                    }
                    actions={<CreateTaskButton projects={activeProjects} />}
                />

                <TasksToolbar
                    projects={projectsList}
                    partners={partnersList}
                    currentStatus={statusFilter}
                    currentUrgency={urgencyFilter}
                    currentOverdue={overdueOnly}
                    currentDueToday={dueTodayOnly}
                    currentSort={sort}
                    currentCols={cols}
                    currentProject={projectId || "all"}
                    currentPartner={partnerId || "all"}
                    totalTasks={totalTasks}
                />

                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                    hourlyRate={hourlyRate}
                    view={view}
                    cols={cols}
                    searchApiFilters={{
                        status: statusFilter,
                        partnerId,
                        projectId,
                        urgency: urgencyFilter,
                        overdue: overdueOnly,
                        dueToday: dueTodayOnly,
                        sort,
                        page,
                        perPage,
                    }}
                />
                <div className="mt-10 border-t border-slate-200/70 pt-7">
                    {renderTasksSummaryRow()}
                </div>

                <div className="mt-5 border-t border-slate-200/70 pt-5">
                    {renderPaginationBar()}
                </div>
            </div>
        </TasksSearchProvider>
    )
}
