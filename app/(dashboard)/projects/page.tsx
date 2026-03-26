import prisma from "@/lib/prisma"
import Link from "next/link"
import {
    SlidersHorizontal,
} from "lucide-react"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { cn, formatProjectServiceList } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import { requireTenantContext } from "@/lib/tenant"
import { buttonLinkClassName } from "@/components/ui/button-link"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { ProjectsBoardRows } from "@/components/projects/projects-board-rows"
import { ProjectsFiltersToolbar } from "@/components/projects/projects-filters-toolbar"
import { ProjectsSearchInput } from "@/components/projects/projects-search-input"
import { ProjectsSearchProvider } from "@/components/projects/projects-search-context"
import { ProjectsPaginationBar } from "@/components/projects/projects-pagination-bar"
import { buildProjectWhereInput, normalizeProjectFilters } from "@/lib/filters/project-filters"

export const dynamic = "force-dynamic"

const PAGE_SIZE_OPTIONS = [100, 250, 500] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]
const PAGE_SIZE_VALUES = new Set<number>(PAGE_SIZE_OPTIONS)
const PAGINATION_THRESHOLD = 250

const statusOptions = [
    { label: "All", value: "All" },
    { label: "Active", value: "Active" },
    { label: "Paused", value: "Paused" },
    { label: "Completed", value: "Completed" },
    { label: "Closed", value: "Closed" },
]

const paymentOptions = [
    { label: "All", value: "All" },
    { label: "Paid", value: "Paid" },
    { label: "Unpaid", value: "Unpaid" },
]

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
        perPage?: string
        filters?: string
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
    const layout = "list"
    const mobileFiltersOpen = params.filters === "1"
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

    const buildHref = (overrides: Record<string, string | null | undefined>) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (queryStatus) next.set("status", queryStatus)
        if (partnerId) next.set("partnerId", partnerId)
        if (payment) next.set("payment", payment)
        if (recurring) next.set("recurring", recurring)
        if (period) next.set("period", period)
        if (fromParam) next.set("from", fromParam)
        if (toParam) next.set("to", toParam)
        if (sort && sort !== DEFAULT_SORT) next.set("sort", sort)
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
                (key === "sort" && value === DEFAULT_SORT) ||
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

        return `/projects?${next.toString()}`
    }

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
                <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div className="md:hidden flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <MobileMenuTrigger />
                                <h1 className="page-title text-slate-900">Projects</h1>
                            </div>
                            <CreateProjectButton
                                variant="full"
                                label="Add Project"
                                showLabelOnMobile
                                className="!h-12 !w-auto !min-w-[148px] !rounded-2xl !px-4 !gap-2 !bg-[color:color-mix(in_srgb,var(--primary-container)_16%,white)] !text-[var(--primary)] !shadow-none border border-[color:color-mix(in_srgb,var(--primary-container)_40%,transparent)] hover:!bg-[color:color-mix(in_srgb,var(--primary-container)_24%,white)]"
                                partners={partnersForClient}
                                services={servicesForClient}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <ProjectsSearchInput />
                            </div>

                            <Link
                                href={buildHref({ filters: mobileFiltersOpen ? null : "1", page: "1" })}
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
                                    {statusOptions.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ status: option.value, page: "1" })}
                                            className={cn(
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors",
                                                queryStatus === option.value
                                                    ? "bg-white text-[var(--primary)] shadow-sm"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {option.label}
                                        </Link>
                                    ))}
                                </div>

                                <div className="h-8 w-px shrink-0 bg-slate-200" />

                                <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                                    {paymentOptions.map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ payment: option.value, page: "1" })}
                                            className={cn(
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors",
                                                payment === option.value
                                                    ? "bg-white text-[var(--primary)] shadow-sm"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {option.label}
                                        </Link>
                                    ))}
                                </div>

                                <div className="h-8 w-px shrink-0 bg-slate-200" />

                                <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                                    {[
                                        { label: "Updated", value: "updated_desc" },
                                        { label: "Newest", value: "created_desc" },
                                        { label: "Oldest", value: "created_asc" },
                                        { label: "Amount", value: "amount_desc" },
                                        { label: "Time", value: "time_desc" },
                                    ].map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ sort: option.value, page: "1" })}
                                            className={cn(
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[12px] font-medium tracking-[0.02em] transition-colors",
                                                sort === option.value
                                                    ? "bg-white text-[var(--primary)] shadow-sm"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {option.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DashboardPageHeader
                        title="Projects"
                        search={<ProjectsSearchInput />}
                        actions={(
                            <CreateProjectButton
                                variant="full"
                                label="Add Project"
                                partners={partnersForClient}
                                services={servicesForClient}
                            />
                        )}
                    />

                    <div className={cn(mobileFiltersOpen ? "block" : "hidden", "md:block")}>
                        <ProjectsFiltersToolbar
                            partners={partnersList}
                            currentStatus={queryStatus}
                            currentPayment={payment}
            currentRecurring={recurring}
            currentPeriod={period}
            currentFrom={fromParam || ""}
            currentTo={toParam || ""}
            currentSort={sort}
            currentPartnerId={partnerId || "all"}
            totalProjects={totalProjects}
                        />
                    </div>
                </div>

                <ProjectsBoardRows
                    projects={projectsForClient}
                    layout={layout as "grid" | "list"}
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
            </ProjectsSearchProvider>
        </ProjectSheetWrapper>
    )
}
