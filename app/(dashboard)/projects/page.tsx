import prisma from "@/lib/prisma"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { formatProjectServiceList } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import { requireTenantContext } from "@/lib/tenant"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { ProjectsBoardRows } from "@/components/projects/projects-board-rows"
import { ProjectsFiltersToolbar } from "@/components/projects/projects-filters-toolbar"
import { ProjectsSearchInput } from "@/components/projects/projects-search-input"
import { ProjectsSearchProvider } from "@/components/projects/projects-search-context"
import { ProjectsPaginationBar } from "@/components/projects/projects-pagination-bar"
import { buildProjectWhereInput, normalizeProjectFilters } from "@/lib/filters/project-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE_OPTIONS = [50, 100, 250] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGE_SIZE_VALUES = new Set<number>(PAGE_SIZE_OPTIONS)
const PAGINATION_THRESHOLD = 120

const sortOptions = [
    { label: "Recently Updated", value: "updated_desc" },
    { label: "Created (Newest)", value: "created_desc" },
    { label: "Created (Oldest)", value: "created_asc" },
    { label: "Amount (High-Low)", value: "amount_desc" },
    { label: "Amount (Low-High)", value: "amount_asc" },
    { label: "Time (Most)", value: "time_desc" },
    { label: "Time (Least)", value: "time_asc" },
    { label: "Name (A-Z)", value: "name_asc" },
    { label: "Name (Z-A)", value: "name_desc" },
] as const
const DEFAULT_SORT = "amount_desc"
const SORT_VALUES = new Set(sortOptions.map((option) => option.value))

type ProjectBoardSortBy = "createdAt" | "updatedAt" | "amount" | "name" | "time"
type ProjectBoardSortDirection = "asc" | "desc"

function resolveBoardSort(sort: string): { by: ProjectBoardSortBy; direction: ProjectBoardSortDirection } {
    switch (sort) {
        case "created_desc":
            return { by: "createdAt", direction: "desc" }
        case "created_asc":
            return { by: "createdAt", direction: "asc" }
        case "amount_desc":
            return { by: "amount", direction: "desc" }
        case "amount_asc":
            return { by: "amount", direction: "asc" }
        case "time_desc":
            return { by: "time", direction: "desc" }
        case "time_asc":
            return { by: "time", direction: "asc" }
        case "name_asc":
            return { by: "name", direction: "asc" }
        case "name_desc":
            return { by: "name", direction: "desc" }
        case "updated_desc":
        default:
            return { by: "updatedAt", direction: "desc" }
    }
}

export default async function ProjectsPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string
        status?: string
        partnerId?: string
        payment?: string
        recurring?: string
        period?: string
        from?: string
        to?: string
        sort?: string
        view?: string
        perPage?: string
        page?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const normalizedFilters = normalizeProjectFilters({
        q: params.q,
        status: params.status,
        payment: params.payment,
        recurring: params.recurring,
        partnerId: params.partnerId,
        period: params.period,
        from: params.from,
        to: params.to,
    })
    const q = normalizedFilters.q
    const queryStatus = normalizedFilters.status
    const partnerId = normalizedFilters.partnerId
    const payment = normalizedFilters.payment
    const recurring = normalizedFilters.recurring
    const period = normalizedFilters.period
    const fromParam = normalizedFilters.from
    const toParam = normalizedFilters.to
    const sortRaw = params.sort || DEFAULT_SORT
    const sort = SORT_VALUES.has(sortRaw as (typeof sortOptions)[number]["value"]) ? sortRaw : DEFAULT_SORT
    const perPageRaw = Number(params.perPage)
    const perPage = PAGE_SIZE_VALUES.has(perPageRaw) ? perPageRaw : DEFAULT_PAGE_SIZE
    const viewRaw = params.view
    const layout: "grid" | "list" = viewRaw === "grid" ? "grid" : "list"
    const requestedPage = Math.max(1, Number(params.page) || 1)

    const projectWhere = buildProjectWhereInput({
        tenantId: session.tenantId,
        filters: normalizedFilters,
        now: new Date(),
    })

    const totalProjects = await prisma.project.count({ where: projectWhere })
    const shouldPaginate = totalProjects > PAGINATION_THRESHOLD
    const page = shouldPaginate ? requestedPage : 1

    const [projectsRaw, partnersFullRaw, servicesRaw] = await Promise.all([
        prisma.project.findMany({
            where: projectWhere,
            include: {
                site: {
                    include: {
                        partner: true,
                    },
                },
                services: true,
                tasks: {
                    orderBy: { createdAt: "asc" },
                    include: { timeLogs: true },
                },
                timeLogs: {
                    orderBy: { startTime: "desc" },
                    include: { task: true },
                },
                _count: {
                    select: {
                        tasks: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            ...(shouldPaginate ? { skip: (page - 1) * perPage, take: perPage } : {}),
        }),
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
            include: {
                sites: {
                    select: { id: true, domainName: true },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.service.findMany({
            where: { tenantId: session.tenantId },
            orderBy: { serviceName: "asc" },
        }),
    ])

    const partnersList = partnersFullRaw.map((partner) => ({ id: partner.id, name: partner.name }))
    const boardSort = resolveBoardSort(sort)

    const projects = projectsRaw.map((project) => {
        const completedTasks = project.tasks.filter((task) => task.status === "Completed").length
        const secondsLogged = project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds ?? 0), 0)
        const isRecurring = project.services.some((service) => service.isRecurring)
        const serviceLabel = formatProjectServiceList(project.services, "No service")
        return {
            ...project,
            status: normalizeProjectStatus(project.status),
            completedTasks,
            secondsLogged,
            isRecurring,
            serviceLabel,
            amount: Number(project.currentFee ?? 0),
        }
    })

    const projectsForClient = JSON.parse(JSON.stringify(projects))
    const partnersForClient = JSON.parse(JSON.stringify(partnersFullRaw))
    const servicesForClient = JSON.parse(JSON.stringify(servicesRaw))

    const totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalProjects / perPage)) : 1
    const prevPage = shouldPaginate && page > 1 ? page - 1 : null
    const nextPage = shouldPaginate && page < totalPages ? page + 1 : null
    const pageStart = totalProjects === 0 ? 0 : (page - 1) * perPage + 1
    const pageEnd = shouldPaginate ? Math.min(page * perPage, totalProjects) : totalProjects

    const user = await prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: { hourlyRate: true }
    })

    return (
        <ProjectSheetWrapper
            projects={projectsForClient}
            allServices={servicesForClient}
            hourlyRate={user?.hourlyRate ? Number(user.hourlyRate) : 0}
        >
            <ProjectsSearchProvider initialSearch={q || ""}>
                <div className="space-y-5 sm:space-y-6">
                    <div className="flex flex-col gap-3.5 sm:gap-4">
                        <div className="rounded-[24px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.9))] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4 lg:p-5">
                            <DashboardPageHeader
                                title="Projects"
                                showMobile
                                search={<ProjectsSearchInput />}
                                mobileSearch={<ProjectsSearchInput />}
                                mobileActions={(
                                    <CreateProjectButton
                                        variant="full"
                                        label="Add"
                                        showLabelOnMobile
                                        className="!h-11 !w-auto !min-w-0 !rounded-[24px] !px-8 !gap-2 !text-white xl:!px-9"
                                        partners={partnersForClient}
                                        services={servicesForClient}
                                    />
                                )}
                                actions={(
                                    <CreateProjectButton
                                        variant="full"
                                        label="Add"
                                        showLabelOnMobile
                                        className="!h-11 !w-auto !min-w-0 !rounded-[24px] !px-8 !gap-2 !text-white xl:!px-9"
                                        partners={partnersForClient}
                                        services={servicesForClient}
                                    />
                                )}
                            />
                        </div>
                        <ProjectsFiltersToolbar
                            partners={partnersList}
                            currentStatus={queryStatus}
                            currentPayment={payment}
                            currentRecurring={recurring}
                            currentPeriod={period}
                            currentFrom={fromParam || ""}
                            currentTo={toParam || ""}
                            currentSort={sort}
                            currentView={layout}
                            currentPartnerId={partnerId || "all"}
                            totalProjects={totalProjects}
                        />
                    </div>

                <ProjectsBoardRows
                    projects={projectsForClient}
                    layout={layout}
                    partners={partnersForClient}
                    services={servicesForClient}
                    hourlyRate={user?.hourlyRate ? Number(user.hourlyRate) : 0}
                    initialSortBy={boardSort.by}
                    initialSortDirection={boardSort.direction}
                    searchApiFilters={{
                        status: queryStatus,
                        payment,
                        recurring,
                        partnerId,
                        period,
                        from: fromParam,
                        to: toParam,
                        sort,
                        page,
                        perPage,
                    }}
                />

                <div className="mt-4 sm:mt-5">
                    <ProjectsPaginationBar
                        fallback={{
                            total: totalProjects,
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
                </div>
                </div>
            </ProjectsSearchProvider>
        </ProjectSheetWrapper>
    )
}
