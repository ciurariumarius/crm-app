import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import { TasksSearchProvider } from "@/components/tasks/tasks-search-context"
import { TasksPaginationBar } from "@/components/tasks/tasks-pagination-bar"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { SlidersHorizontal, X, ListChecks, Play, AlertTriangle, CalendarClock, CalendarDays } from "lucide-react"
import { requireTenantContext } from "@/lib/tenant"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "@/lib/filters/task-filters"
import { buttonLinkClassName } from "@/components/ui/button-link"

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
        filters?: string
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
    const mobileFiltersOpen = params.filters === "1"
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
        if (mobileFiltersOpen) next.set("filters", "1")
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
    const selectedProject = projectsList.find((project) => project.id === projectId)
    const selectedPartner = partnersList.find((partner) => partner.id === partnerId)
    const activeFilters: { key: string; label: string; href: string }[] = []
    if (q) activeFilters.push({ key: "q", label: `Search: ${q}`, href: buildTasksHref({ q: null, page: "1" }) })
    if (statusFilter !== "Active") activeFilters.push({ key: "status", label: `Status: ${statusFilter}`, href: buildTasksHref({ status: "Active", page: "1" }) })
    if (urgencyFilter !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${urgencyFilter}`, href: buildTasksHref({ urgency: "all", page: "1" }) })
    if (overdueOnly) activeFilters.push({ key: "overdue", label: "Overdue", href: buildTasksHref({ overdue: null, page: "1" }) })
    if (dueTodayOnly) activeFilters.push({ key: "dueToday", label: "Due today", href: buildTasksHref({ dueToday: null, page: "1" }) })
    if (projectId && projectId !== "all") activeFilters.push({ key: "projectId", label: `Project: ${selectedProject?.name || "Selected"}`, href: buildTasksHref({ projectId: null, page: "1" }) })
    if (partnerId && partnerId !== "all") activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner?.name || "Selected"}`, href: buildTasksHref({ partnerId: null, page: "1" }) })
    const clearAllHref = buildTasksHref({
        q: null,
        status: "Active",
        urgency: "all",
        overdue: null,
        dueToday: null,
        sort: "newest",
        cols: "3",
        projectId: null,
        partnerId: null,
        page: "1",
    })

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
            <div className="flex flex-col gap-6">
            <div className="md:hidden flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <MobileMenuTrigger />
                        <h1 className="page-title text-slate-900">Tasks</h1>
                    </div>
                    <CreateTaskButton
                        projects={activeProjects}
                        label="Add Task"
                        showLabelOnMobile
                        className="!h-12 !w-auto !min-w-[148px] !rounded-2xl !px-4 !gap-2 !bg-[#EFF6FF] !text-[#2563EB] !shadow-none border border-[#BFDBFE] hover:!bg-[#DBEAFE]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <TasksSearchInput />
                    </div>
                    <Link
                        href={buildTasksHref({ filters: mobileFiltersOpen ? null : "1", page: "1" })}
                        className={buttonLinkClassName({
                            size: "lg",
                            variant: mobileFiltersOpen ? "activeBlue" : "subtle",
                            className: "w-11 rounded-2xl px-0",
                        })}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                    </Link>
                </div>

                <div className="-mx-1 overflow-x-auto px-1 hidescrollbar">
                    <div className="inline-flex min-w-max items-center gap-3">
                        <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                            {[
                                { label: "All", value: "All" },
                                { label: "Active", value: "Active" },
                                { label: "Completed", value: "Completed" },
                            ].map((option) => (
                                <Link
                                    key={option.value}
                                    href={buildTasksHref({ status: option.value, page: "1" })}
                                    className={
                                        "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors " +
                                        (statusFilter === option.value
                                            ? "bg-white text-[#2563EB] shadow-sm"
                                            : "text-slate-600")
                                    }
                                >
                                    {option.label}
                                </Link>
                            ))}
                        </div>

                        <div className="h-8 w-px shrink-0 bg-slate-200" />

                        <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                            {[
                                { label: "All", value: "all" },
                                { label: "Urgent", value: "Urgent" },
                                { label: "Normal", value: "Normal" },
                                { label: "Idea", value: "Idea" },
                            ].map((option) => (
                                <Link
                                    key={option.value}
                                    href={buildTasksHref({ urgency: option.value, page: "1" })}
                                    className={
                                        "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors " +
                                        (urgencyFilter === option.value
                                            ? "bg-white text-[#2563EB] shadow-sm"
                                            : "text-slate-600")
                                    }
                                >
                                    {option.label}
                                </Link>
                            ))}
                        </div>

                        <div className="h-8 w-px shrink-0 bg-slate-200" />

                        <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                            {[
                                { label: "Newest", value: "newest" },
                                { label: "Oldest", value: "oldest" },
                                { label: "Updated", value: "updated" },
                                { label: "A-Z", value: "name_asc" },
                                { label: "Z-A", value: "name_desc" },
                            ].map((option) => (
                                <Link
                                    key={option.value}
                                    href={buildTasksHref({ sort: option.value, page: "1" })}
                                    className={
                                        "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors " +
                                        (sort === option.value
                                            ? "bg-white text-[#2563EB] shadow-sm"
                                            : "text-slate-600")
                                    }
                                >
                                    {option.label}
                                </Link>
                            ))}
                        </div>

                        <div className="h-8 w-px shrink-0 bg-slate-200" />

                        <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                            <Link
                                href={buildTasksHref({ overdue: overdueOnly ? null : "1", page: "1" })}
                                className={
                                    "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors " +
                                    (overdueOnly ? "bg-white text-[#2563EB] shadow-sm" : "text-slate-600")
                                }
                            >
                                Overdue
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] text-slate-500 font-semibold">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>{totalTasks} results</span>
                    </div>
                    {activeFilters.length > 0 && (
                        <Link
                            href={clearAllHref}
                            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Clear all
                        </Link>
                    )}
                </div>

                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {activeFilters.map((filter) => (
                            <Link
                                key={filter.key}
                                href={filter.href}
                                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-2.5 pr-2 text-[11px] font-medium text-slate-700 hover:bg-white"
                            >
                                <span className="max-w-[180px] truncate">{filter.label}</span>
                                <X className="h-3 w-3 text-slate-400" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Header Row (Desktop) */}
            <DashboardPageHeader
                title="Tasks"
                search={<TasksSearchInput />}
                actions={<CreateTaskButton projects={activeProjects} />}
            />

            <div className="md:hidden space-y-4">
                {mobileFiltersOpen ? (
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
                        mobileSecondaryOnly
                    />
                ) : null}

                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                    hourlyRate={hourlyRate}
                    view="grid"
                    cols={1}
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

            <div className="hidden md:block space-y-4">
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
            </div>
        </TasksSearchProvider>
    )
}
