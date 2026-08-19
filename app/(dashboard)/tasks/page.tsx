import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import {
    TasksActiveFilterChips,
    TasksFilterControl,
    TasksSortControl,
    TasksStatusControls,
} from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus, normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import { TasksSearchProvider } from "@/components/tasks/tasks-search-context"
import { TasksPaginationBar } from "@/components/tasks/tasks-pagination-bar"
import { Prisma } from "@prisma/client"
import { requireAuth } from "@/lib/auth"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "@/lib/filters/task-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE_OPTIONS = [50, 100, 250] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGE_SIZE_VALUES = new Set<number>(PAGE_SIZE_OPTIONS)
const PAGINATION_THRESHOLD = 120
const SORT_OPTIONS = [
    { label: "Most recent", value: "newest" },
    { label: "Oldest", value: "oldest" },
    { label: "Updated", value: "updated" },
    { label: "Name A-Z", value: "name_asc" },
    { label: "Name Z-A", value: "name_desc" },
] as const
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value))

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

    const [tasksRaw, allServicesRaw, activeTimerRaw, allProjectsRaw, userRaw] = await Promise.all([
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
                lmsWorkEntry: {
                    select: { id: true, durationMinutes: true, workDate: true, exportedAt: true },
                },
            },
            orderBy: buildSort(sort),
            ...(shouldPaginate ? { skip: (page - 1) * perPage, take: perPage } : {}),
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
    const headerFilterProps = {
        projects: projectsList,
        partners: partnersList,
        currentUrgency: urgencyFilter,
        currentOverdue: overdueOnly,
        currentDueToday: dueTodayOnly,
        currentSort: sort,
        currentProject: projectId || "all",
        currentTaskId: taskId || "all",
        currentPartner: partnerId || "all",
        currentScope: taskScope,
        totalTasks,
    }

    const totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalTasks / perPage)) : 1
    const prevPage = shouldPaginate && page > 1 ? page - 1 : null
    const nextPage = shouldPaginate && page < totalPages ? page + 1 : null
    const pageStart = totalTasks === 0 ? 0 : (page - 1) * perPage + 1
    const pageEnd = shouldPaginate ? Math.min(page * perPage, totalTasks) : totalTasks
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
        <TasksSearchProvider initialSearch={q || ""} initialStatusRefined={Boolean(params.status)}>
            <div className="flex flex-col gap-3.5 sm:gap-4">
                <AppPageHeader
                    title="Tasks"
                    search={<TasksSearchInput />}
                    mobileSearch={<TasksSearchInput />}
                    controls={<TasksStatusControls currentStatus={statusFilter} />}
                    secondaryActions={
                        <div className="flex items-center gap-2">
                            <TasksSortControl currentSort={sort} />
                            <TasksFilterControl {...headerFilterProps} />
                        </div>
                    }
                    footer={<TasksActiveFilterChips {...headerFilterProps} />}
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

                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                    hourlyRate={hourlyRate}
                    view={view}
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
                <div className="mt-1">
                    {renderPaginationBar()}
                </div>
            </div>
        </TasksSearchProvider>
    )
}
