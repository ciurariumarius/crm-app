import prisma from "@/lib/prisma"
import Link from "next/link"
import {
    CalendarDays,
    ChevronDown,
    SlidersHorizontal,
    ArrowUpDown,
    X,
    LayoutGrid,
    Play,
    Circle,
    CheckCheck,
    XCircle,
    Wallet,
    CheckCircle2,
    AlertCircle,
} from "lucide-react"
import {
    endOfMonth,
    endOfYear,
    startOfMonth,
    startOfYear,
    subMonths,
    subYears,
} from "date-fns"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import { requireTenantContext } from "@/lib/tenant"
import { Prisma } from "@prisma/client"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { ProjectsBoardRows } from "@/components/projects/projects-board-rows"
import { PartnerFilterCombobox } from "@/components/projects/partner-filter-combobox"
import { ProjectsSearchInput } from "@/components/projects/projects-search-input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50
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

const recurringOptions = [
    { label: "All", value: "All" },
    { label: "Monthly", value: "Recurring" },
    { label: "One-time", value: "OneTime" },
]

const periodOptions = [
    { label: "All Time", value: "all_time" },
    { label: "This Month", value: "this_month" },
    { label: "Last Month", value: "last_month" },
    { label: "This Year", value: "this_year" },
    { label: "Last Year", value: "last_year" },
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
        sort?: string
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
    const sortRaw = params.sort || DEFAULT_SORT
    const sort = SORT_VALUES.has(sortRaw as (typeof sortOptions)[number]["value"]) ? sortRaw : DEFAULT_SORT
    const layout = "list"
    const mobileFiltersOpen = params.filters === "1"
    const requestedPage = Math.max(1, Number(params.page) || 1)

    const now = new Date()
    let dateFilter: Prisma.ProjectWhereInput = {}

    if (period === "this_month") {
        dateFilter = {
            createdAt: {
                gte: startOfMonth(now),
                lte: endOfMonth(now),
            },
        }
    } else if (period === "last_month") {
        const lastMonth = subMonths(now, 1)
        dateFilter = {
            createdAt: {
                gte: startOfMonth(lastMonth),
                lte: endOfMonth(lastMonth),
            },
        }
    } else if (period === "this_year") {
        dateFilter = {
            createdAt: {
                gte: startOfYear(now),
                lte: endOfYear(now),
            },
        }
    } else if (period === "last_year") {
        const lastYear = subYears(now, 1)
        dateFilter = {
            createdAt: {
                gte: startOfYear(lastYear),
                lte: endOfYear(lastYear),
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
            ...(shouldPaginate ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
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
    const filteredPartner = partnersList.find((partner) => partner.id === partnerId)
    const selectedPeriodLabel = periodOptions.find((option) => option.value === period)?.label || "All Time"
    const selectedPaymentLabel = paymentOptions.find((option) => option.value === payment)?.label || "All"
    const selectedRecurringLabel = recurringOptions.find((option) => option.value === recurring)?.label || "All"
    const selectedSortLabel = sortOptions.find((option) => option.value === sort)?.label || sortOptions[0].label
    const boardSort = resolveBoardSort(sort)

    const projects = projectsRaw.map((project) => {
        const completedTasks = project.tasks.filter((task) => task.status === "Completed").length
        const secondsLogged = project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds ?? 0), 0)
        const isRecurring = project.services.some((service) => service.isRecurring)
        const serviceLabel = project.services.map((service) => service.serviceName).join(" + ") || "No service"
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
    const projectStatusCounts = projects.reduce(
        (acc, project) => {
            acc[project.status] += 1
            return acc
        },
        { Active: 0, Paused: 0, Completed: 0, Closed: 0 } as Record<"Active" | "Paused" | "Completed" | "Closed", number>
    )

    const totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalProjects / PAGE_SIZE)) : 1
    const prevPage = shouldPaginate && page > 1 ? page - 1 : null
    const nextPage = shouldPaginate && page < totalPages ? page + 1 : null

    const buildHref = (overrides: Record<string, string | null | undefined>) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (queryStatus) next.set("status", queryStatus)
        if (partnerId) next.set("partnerId", partnerId)
        if (payment) next.set("payment", payment)
        if (recurring) next.set("recurring", recurring)
        if (period) next.set("period", period)
        if (sort && sort !== DEFAULT_SORT) next.set("sort", sort)
        if (mobileFiltersOpen) next.set("filters", "1")
        if (shouldPaginate) {
            next.set("page", String(page))
        }

        for (const [key, value] of Object.entries(overrides)) {
            if (value === null || value === undefined || value === "" || (key === "sort" && value === DEFAULT_SORT)) {
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

    const activeFilters: { key: string; label: string; href: string }[] = []
    if (q) activeFilters.push({ key: "q", label: `Search: ${q}`, href: buildHref({ q: null, page: "1" }) })
    if (queryStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${queryStatus}`, href: buildHref({ status: "Active", page: "1" }) })
    if (payment !== "All") activeFilters.push({ key: "payment", label: `Payment: ${selectedPaymentLabel}`, href: buildHref({ payment: "All", page: "1" }) })
    if (recurring !== "All") activeFilters.push({ key: "recurring", label: `Type: ${selectedRecurringLabel}`, href: buildHref({ recurring: "All", page: "1" }) })
    if (partnerId) activeFilters.push({ key: "partnerId", label: `Partner: ${filteredPartner?.name || "Selected"}`, href: buildHref({ partnerId: null, page: "1" }) })
    if (period !== "all_time") activeFilters.push({ key: "period", label: `Period: ${selectedPeriodLabel}`, href: buildHref({ period: "all_time", page: "1" }) })
    const clearAllHref = buildHref({
        q: null,
        status: "Active",
        payment: "All",
        recurring: "All",
        sort: DEFAULT_SORT,
        partnerId: null,
        period: "all_time",
        page: "1",
    })
    const resultsSummary = `${totalProjects} results`

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

                    <div className={cn(
                        "z-20 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 md:px-4 md:py-4 shadow-sm backdrop-blur-[6px]",
                        mobileFiltersOpen ? "block" : "hidden",
                        "md:sticky md:top-3 md:block"
                    )}>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className={cn(mobileFiltersOpen && "hidden md:block")}>
                                        <div className="inline-flex h-11 items-center rounded-2xl border border-slate-300/40 bg-slate-200/50 p-1 shadow-inner">
                                            {[
                                                { label: "All", value: "All", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                                                { label: "Active", value: "Active", icon: <Play className="h-3.5 w-3.5 fill-current" /> },
                                                { label: "Paused", value: "Paused", icon: <Circle className="h-3.5 w-3.5" /> },
                                                { label: "Done", value: "Completed", icon: <CheckCheck className="h-3.5 w-3.5" /> },
                                                { label: "Closed", value: "Closed", icon: <XCircle className="h-3.5 w-3.5" /> },
                                            ].map((option) => (
                                                <Link
                                                    key={option.value}
                                                    href={buildHref({ status: option.value, page: "1" })}
                                                    className={cn(
                                                        "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all",
                                                        queryStatus === option.value
                                                            ? "bg-white text-blue-700 shadow-md ring-1 ring-black/[0.05] scale-[1.02]"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    )}
                                                >
                                                    {option.icon}
                                                    {option.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={cn(mobileFiltersOpen && "hidden md:block")}>
                                        <div className="inline-flex h-11 items-center rounded-2xl border border-slate-300/40 bg-slate-200/50 p-1 shadow-inner">
                                            {[
                                                { label: "All", value: "All", icon: <Wallet className="h-3.5 w-3.5" /> },
                                                { label: "Paid", value: "Paid", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
                                                { label: "Unpaid", value: "Unpaid", icon: <AlertCircle className="h-3.5 w-3.5" /> },
                                            ].map((option) => (
                                                <Link
                                                    key={option.value}
                                                    href={buildHref({ payment: option.value, page: "1" })}
                                                    className={cn(
                                                        "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-all",
                                                        payment === option.value
                                                            ? "bg-white text-blue-700 shadow-md ring-1 ring-black/[0.05] scale-[1.02]"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    )}
                                                >
                                                    {option.icon}
                                                    {option.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition-all shadow-sm",
                                                        recurring !== "All"
                                                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                                                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <span>{selectedRecurringLabel}</span>
                                                    <ChevronDown className="h-4 w-4 opacity-70" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                                {recurringOptions.map((option) => (
                                                    <DropdownMenuItem key={option.value} asChild className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700">
                                                        <Link href={buildHref({ recurring: option.value, page: "1" })}>
                                                            {option.label}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <PartnerFilterCombobox partners={partnersList} currentPartnerId={partnerId} />

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold transition-all shadow-sm",
                                                        period !== "all_time"
                                                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                                                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <CalendarDays className={cn("h-4 w-4", period !== "all_time" ? "text-blue-600" : "text-slate-400")} />
                                                    <span>{selectedPeriodLabel}</span>
                                                    <ChevronDown className="h-4 w-4 opacity-70" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                                {periodOptions.map((option) => (
                                                    <DropdownMenuItem key={option.value} asChild className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700">
                                                        <Link href={buildHref({ period: option.value, page: "1" })}>
                                                            {option.label}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <div className="hidden h-7 w-px bg-slate-200 sm:block mx-1" />

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    title={`Sort: ${selectedSortLabel}`}
                                                    aria-label={`Sort: ${selectedSortLabel}`}
                                                    className={cn(
                                                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-sm",
                                                        sort !== DEFAULT_SORT
                                                            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100/50"
                                                            : "border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <ArrowUpDown className={cn("h-4 w-4", sort !== DEFAULT_SORT ? "text-blue-600" : "text-slate-400")} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                                {sortOptions.map((option) => (
                                                    <DropdownMenuItem key={option.value} asChild className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-700">
                                                        <Link href={buildHref({ sort: option.value, page: "1" })}>
                                                            {option.label}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <div className="hidden h-7 w-px bg-slate-200 sm:block mx-1" />

                                        <div className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-50 px-3 text-[11px] font-extrabold text-slate-500 ring-1 ring-slate-200/50" title={resultsSummary}>
                                            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" />
                                            <span>{totalProjects}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {activeFilters.length > 0 && !mobileFiltersOpen && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100/50 pt-3">
                                    {activeFilters.map((filter) => (
                                        <Link
                                            key={filter.key}
                                            href={filter.href}
                                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/50 pl-2 pr-1.5 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100 transition-colors"
                                            title={`Remove ${filter.label}`}
                                        >
                                            <span className="max-w-[120px] truncate">{filter.label}</span>
                                            <X className="h-2.5 w-2.5 opacity-60" />
                                        </Link>
                                    ))}
                                    <Link
                                        href={clearAllHref}
                                        className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-extrabold text-slate-600 hover:bg-slate-50"
                                    >
                                        Clear all
                                    </Link>
                                </div>
                            )}
                        </div>
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

                {shouldPaginate && (
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Page {page} of {totalPages} · {totalProjects} projects</span>
                        <div className="flex items-center gap-2">
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
                )}
            </div>
        </ProjectSheetWrapper>
    )
}
