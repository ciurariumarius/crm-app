import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import { TasksSearchProvider } from "@/components/tasks/tasks-search-context"
import { TasksPaginationBar } from "@/components/tasks/tasks-pagination-bar"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { ListChecks, Play, AlertTriangle, CalendarClock, CalendarDays } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "@/lib/filters/task-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE_OPTIONS = [50, 100, 250] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGE_SIZE_VALUES = new Set<number>(PAGE_SIZE_OPTIONS)
const PAGINATION_THRESHOLD = 120
const SORT_OPTIONS = [
    { label: "Newest", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Updated", value: "updated" },
    { label: "Name A-Z", value: "name_asc" },
    { label: "Name Z-A", value: "name_desc" },
] as const
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value))
const COL_VALUES = new Set(["3", "4"])
const OVERVIEW_ROW_CLASS =
    "flex w-max min-w-full overflow-hidden rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] md:w-full"
const OVERVIEW_ITEM_CLASS =
    "group relative flex min-w-[182px] items-center gap-3 px-3.5 py-3 transition-all hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] md:min-w-0 md:flex-1"
const OVERVIEW_ICON_CLASS =
    "flex h-8 w-8 items-center justify-center rounded-[10px] border bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]"

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
        taskId?: string
        urgency?: string
        overdue?: string
        dueToday?: string
        sort?: string
        perPage?: string
        page?: string
        cols?: string
        scope?: string
    }>
}) {
    const session = await requireAuth()
    const params = await searchParams
    const normalizedFilters = normalizeTaskFilters({
        q: params.q,
        status: params.status,
        partnerId: params.partnerId,
        projectId: params.projectId,
        taskId: params.taskId,
        urgency: params.urgency,
        overdue: params.overdue,
        dueToday: params.dueToday,
        scope: params.scope,
    })
    const q = normalizedFilters.q
    const statusFilter = normalizedFilters.status
    const partnerId = normalizedFilters.partnerId
    const projectId = normalizedFilters.projectId
    const taskId = normalizedFilters.taskId
    const urgencyFilter = normalizedFilters.urgency
    const dueTodayOnly = normalizedFilters.dueTodayOnly
    const overdueOnly = normalizedFilters.overdueOnly
    const sortRaw = params.sort || "newest"
    const sort = SORT_VALUES.has(sortRaw as (typeof SORT_OPTIONS)[number]["value"]) ? sortRaw : "newest"
    const colsRaw = params.cols || "3"
    const cols = COL_VALUES.has(colsRaw) ? Number(colsRaw) : 3
    const taskScope = normalizedFilters.scope
    const perPageRaw = Number(params.perPage)
    const perPage = PAGE_SIZE_VALUES.has(perPageRaw) ? perPageRaw : DEFAULT_PAGE_SIZE
    const view = "grid" as const
    const requestedPage = Math.max(1, Number(params.page) || 1)
    const { todayStart, todayEnd } = getLocalDayBounds(new Date())
    const where = buildTaskWhereInput({
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
                lmsAllocation: {
                    select: { id: true, client: true },
                },
                lmsTaskType: {
                    select: { id: true, name: true, isActive: true, defaultDurationMinutes: true },
                },
            },
            orderBy: buildSort(sort),
            ...(shouldPaginate ? { skip: (page - 1) * perPage, take: perPage } : {}),
        }),
        prisma.task.count({
        }),
        prisma.task.count({
            where: {
                status: { in: ["Active", "Paused"] },
            },
        }),
        prisma.task.count({
            where: {
                status: { in: ["Active", "Paused"] },
                urgency: { in: ["Urgent", "High"] },
            },
        }),
        prisma.task.count({
            where: {
                status: { in: ["Active", "Paused"] },
                deadline: { not: null, lt: todayStart },
            },
        }),
        prisma.task.count({
            where: {
                status: { in: ["Active", "Paused"] },
                deadline: { not: null, gte: todayStart, lte: todayEnd },
            },
        }),
        prisma.service.findMany({ orderBy: { serviceName: "asc" } }),
        prisma.timeLog.findFirst({
            where: { endTime: null },
            include: { task: true, project: true },
        }),
        prisma.project.findMany({
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
            where: { id: session.userId },
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
        if (taskId) next.set("taskId", taskId)
        if (urgencyFilter) next.set("urgency", urgencyFilter)
        if (overdueOnly) next.set("overdue", "1")
        if (dueTodayOnly) next.set("dueToday", "1")
        if (sort && sort !== "newest") next.set("sort", sort)
        if (cols !== 3) next.set("cols", String(cols))
        if (taskScope !== "ALL") next.set("scope", taskScope)
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
        <div className="overflow-x-auto pb-1 xl:overflow-visible hidescrollbar">
            <div className={OVERVIEW_ROW_CLASS}>
                {[
                    {
                        href: buildTasksHref({ q: null, status: "All", urgency: "all", overdue: null, dueToday: null, projectId: null, partnerId: null, taskId: null, scope: null, page: "1" }),
                        label: "Total Tasks",
                        value: totalTasksOverall,
                        icon: <ListChecks className="h-3.5 w-3.5" />,
                        toneClass: "border-blue-100/80 bg-blue-50/80 text-blue-700",
                    },
                    {
                        href: buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: null, dueToday: null, projectId: null, partnerId: null, taskId: null, scope: null, page: "1" }),
                        label: "Active Tasks",
                        value: totalActiveTasks,
                        icon: <Play className="h-3.5 w-3.5 fill-current" />,
                        toneClass: "border-emerald-100/80 bg-emerald-50/80 text-emerald-700",
                    },
                    {
                        href: buildTasksHref({ q: null, status: "Active", urgency: "Urgent", overdue: null, dueToday: null, projectId: null, partnerId: null, taskId: null, scope: null, page: "1" }),
                        label: "Urgent Tasks",
                        value: urgentTasksCount,
                        icon: <AlertTriangle className="h-3.5 w-3.5" />,
                        toneClass: "border-rose-100/80 bg-rose-50/80 text-rose-700",
                    },
                    {
                        href: buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: "1", dueToday: null, projectId: null, partnerId: null, taskId: null, scope: null, page: "1" }),
                        label: "Overdue Tasks",
                        value: overdueTasksCount,
                        icon: <CalendarClock className="h-3.5 w-3.5" />,
                        toneClass: "border-amber-100/80 bg-amber-50/80 text-amber-700",
                    },
                    {
                        href: buildTasksHref({ q: null, status: "Active", urgency: "all", overdue: null, dueToday: "1", projectId: null, partnerId: null, taskId: null, scope: null, page: "1" }),
                        label: "Due Today",
                        value: dueTodayTasksCount,
                        icon: <CalendarDays className="h-3.5 w-3.5" />,
                        toneClass: "border-[color:color-mix(in_srgb,var(--state-review)_22%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--state-review)_10%,var(--surface-lowest))] text-[var(--state-review)]",
                    },
                ].map((item, index, all) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={`${OVERVIEW_ITEM_CLASS} ${index < all.length - 1 ? "border-r border-[var(--line-subtle)]" : ""}`}
                    >
                        <div className={`${OVERVIEW_ICON_CLASS} ${item.toneClass}`}>
                            {item.icon}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold leading-none text-[var(--text-primary)]">{item.label}</p>
                            <p className="mt-1 text-xs font-medium leading-none text-[var(--text-secondary)]">{item.value}</p>
                        </div>
                    </Link>
                ))}
            </div>
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
            <div className="flex flex-col gap-3.5 sm:gap-4">
                    <AppPageHeader
                        title="Tasks"
                        search={<TasksSearchInput />}
                        mobileSearch={<TasksSearchInput />}
                        mobilePrimaryAction={
                            <CreateTaskButton
                                projects={activeProjects}
                                label="Add"
                                showLabelOnMobile
                                className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7"
                            />
                        }
                        primaryAction={
                            <CreateTaskButton
                                projects={activeProjects}
                                label="Add"
                                showLabelOnMobile
                                className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7"
                            />
                        }
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
                    currentTaskId={taskId || "all"}
                    currentPartner={partnerId || "all"}
                    currentScope={taskScope}
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
                        taskId,
                        urgency: urgencyFilter,
                        overdue: overdueOnly,
                        dueToday: dueTodayOnly,
                        scope: taskScope,
                        sort,
                        page,
                        perPage,
                    }}
                />
                <div className="mt-6 sm:mt-8">
                    {renderTasksSummaryRow()}
                </div>

                <div className="mt-4 sm:mt-5">
                    {renderPaginationBar()}
                </div>
            </div>
        </TasksSearchProvider>
    )
}
