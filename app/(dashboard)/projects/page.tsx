import prisma from "@/lib/prisma"
import Link from "next/link"
import {
    ChevronDown,
    SlidersHorizontal,
} from "lucide-react"
import {
    isValid,
    parseISO,
} from "date-fns"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn, formatProjectServiceList } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import { requireTenantContext } from "@/lib/tenant"
import { Prisma } from "@prisma/client"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { ProjectsBoardRows } from "@/components/projects/projects-board-rows"
import { ProjectsFiltersToolbar } from "@/components/projects/projects-filters-toolbar"
import { ProjectsSearchInput } from "@/components/projects/projects-search-input"
import { ProjectsSearchProvider } from "@/components/projects/projects-search-context"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
const DEFAULT_SORT = "updated_desc"
const SORT_VALUES = new Set(sortOptions.map((option) => option.value))

function parseDateParam(value: string | undefined) {
    if (!value) return null
    const parsed = parseISO(value)
    if (!isValid(parsed)) return null
    return parsed
}

function utcDate(year: number, monthIndex: number, day = 1) {
    return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

function addUtcDays(date: Date, days: number) {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + days)
    return next
}

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
    const queryStatusRaw = params.status || "Active"
    const queryStatus = ["All", "Active", "Paused", "Completed", "Closed"].includes(queryStatusRaw) ? queryStatusRaw : "Active"
    const q = params.q?.trim()
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"
    const period = params.period || "all_time"
    const fromParam = params.from
    const toParam = params.to
    const sortRaw = params.sort || DEFAULT_SORT
    const sort = SORT_VALUES.has(sortRaw as (typeof sortOptions)[number]["value"]) ? sortRaw : DEFAULT_SORT
    const perPageRaw = Number(params.perPage)
    const perPage = PAGE_SIZE_VALUES.has(perPageRaw) ? perPageRaw : DEFAULT_PAGE_SIZE
    const layout = "list"
    const mobileFiltersOpen = params.filters === "1"
    const requestedPage = Math.max(1, Number(params.page) || 1)

    const now = new Date()
    let dateFilter: Prisma.ProjectWhereInput = {}

    const parsedFrom = parseDateParam(fromParam)
    const parsedTo = parseDateParam(toParam)

    if (parsedFrom || parsedTo) {
        const fromDate = parsedFrom
            ? utcDate(parsedFrom.getUTCFullYear(), parsedFrom.getUTCMonth(), parsedFrom.getUTCDate())
            : undefined
        const toDateStart = parsedTo
            ? utcDate(parsedTo.getUTCFullYear(), parsedTo.getUTCMonth(), parsedTo.getUTCDate())
            : undefined
        const toDateExclusive = toDateStart ? addUtcDays(toDateStart, 1) : undefined
        const rangeStart = fromDate && toDateStart
            ? (fromDate <= toDateStart ? fromDate : toDateStart)
            : (fromDate || toDateStart)
        const rangeEndExclusive = fromDate && toDateExclusive
            ? (fromDate <= (toDateStart as Date) ? toDateExclusive : addUtcDays(fromDate, 1))
            : (fromDate ? addUtcDays(fromDate, 1) : toDateExclusive)
        dateFilter = {
            createdAt: {
                ...(rangeStart ? { gte: rangeStart } : {}),
                ...(rangeEndExclusive ? { lt: rangeEndExclusive } : {}),
            },
        }
    } else if (period === "this_month") {
        const year = now.getUTCFullYear()
        const month = now.getUTCMonth()
        dateFilter = {
            createdAt: {
                gte: utcDate(year, month, 1),
                lt: utcDate(year, month + 1, 1),
            },
        }
    } else if (period === "last_month") {
        const currentStart = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 1)
        const lastMonthStart = utcDate(currentStart.getUTCFullYear(), currentStart.getUTCMonth() - 1, 1)
        dateFilter = {
            createdAt: {
                gte: lastMonthStart,
                lt: currentStart,
            },
        }
    } else if (period === "this_year") {
        const year = now.getUTCFullYear()
        dateFilter = {
            createdAt: {
                gte: utcDate(year, 0, 1),
                lt: utcDate(year + 1, 0, 1),
            },
        }
    } else if (period === "last_year") {
        const year = now.getUTCFullYear() - 1
        dateFilter = {
            createdAt: {
                gte: utcDate(year, 0, 1),
                lt: utcDate(year + 1, 0, 1),
            },
        }
    }

    const projectWhere: Prisma.ProjectWhereInput = {
        AND: [
            { tenantId: session.tenantId },
            queryStatus === "All"
                ? {}
                : { status: queryStatus },
            payment === "All" ? {} : { paymentStatus: payment },
            partnerId ? { site: { partnerId } } : {},
            recurring === "Recurring" ? { services: { some: { isRecurring: true } } } :
                recurring === "OneTime" ? { services: { some: { isRecurring: false } } } : {},
            dateFilter,
            q ? {
                OR: [
                    { name: { contains: q } },
                    { site: { domainName: { contains: q } } },
                    { services: { some: { serviceName: { contains: q } } } },
                    { site: { partner: { name: { contains: q } } } },
                ],
            } : {},
        ],
    }

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
                                className="!h-12 !w-auto !min-w-[148px] !rounded-2xl !px-4 !gap-2 !bg-[#EFF6FF] !text-[#2563EB] !shadow-none border border-[#BFDBFE] hover:!bg-[#DBEAFE]"
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
                                className={mobileFiltersOpen
                                    ? "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-sm"
                                    : "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"}
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
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                                                queryStatus === option.value
                                                    ? "bg-white text-[#2563EB] shadow-sm"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {option.label.toUpperCase()}
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
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                                                payment === option.value
                                                    ? "bg-white text-[#2563EB] shadow-sm"
                                                    : "text-slate-600"
                                            )}
                                        >
                                            {option.label.toUpperCase()}
                                        </Link>
                                    ))}
                                </div>

                                <div className="h-8 w-px shrink-0 bg-slate-200" />

                                <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                                    {[
                                        { label: "UPDATED", value: "updated_desc" },
                                        { label: "NEWEST", value: "created_desc" },
                                        { label: "OLDEST", value: "created_asc" },
                                        { label: "AMOUNT", value: "amount_desc" },
                                        { label: "TIME", value: "time_desc" },
                                    ].map((option) => (
                                        <Link
                                            key={option.value}
                                            href={buildHref({ sort: option.value, page: "1" })}
                                            className={cn(
                                                "inline-flex h-10 items-center justify-center rounded-full px-5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
                                                sort === option.value
                                                    ? "bg-white text-[#2563EB] shadow-sm"
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

                    <div className="hidden md:flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex items-center gap-3 min-w-[180px]">
                            <MobileMenuTrigger />
                            <h1 className="page-title text-slate-900">Projects</h1>
                        </div>

                        <div className="flex-1 min-w-0">
                            <ProjectsSearchInput />
                        </div>

                        <div className="flex items-center gap-3">
                            <CreateProjectButton
                                variant="full"
                                label="Add Project"
                                partners={partnersForClient}
                                services={servicesForClient}
                            />
                        </div>
                    </div>

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
                />

                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Page {page} of {totalPages} · Showing {pageStart}-{pageEnd} of {totalProjects} projects</span>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted transition-colors"
                                    title="Projects per page"
                                >
                                    {perPage}
                                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <DropdownMenuItem key={size} asChild className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-700">
                                        <Link href={buildHref({ perPage: String(size), page: "1" })}>
                                            {size}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {prevPage ? (
                            <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildHref({ page: String(prevPage) })}>
                                Previous
                            </Link>
                        ) : (
                            <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Previous</span>
                        )}
                        {nextPage ? (
                            <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildHref({ page: String(nextPage) })}>
                                Next
                            </Link>
                        ) : (
                            <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Next</span>
                        )}
                    </div>
                </div>
                </div>
            </ProjectsSearchProvider>
        </ProjectSheetWrapper>
    )
}
