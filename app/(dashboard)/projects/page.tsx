import prisma from "@/lib/prisma"
import Link from "next/link"
import {
    Briefcase,
    CalendarDays,
    ChevronDown,
    SlidersHorizontal,
    X,
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
        filters?: string
        page?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const queryStatusRaw = params.status === "Paused" ? "Closed" : (params.status || "Active")
    const queryStatus = ["All", "Active", "Completed", "Closed"].includes(queryStatusRaw) ? queryStatusRaw : "Active"
    const q = params.q?.trim()
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"
    const period = params.period || "all_time"
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
                : queryStatus === "Closed"
                    ? { status: { in: ["Closed", "Paused"] } }
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
        if (mobileFiltersOpen) next.set("filters", "1")
        if (shouldPaginate) {
            next.set("page", String(page))
        }

        for (const [key, value] of Object.entries(overrides)) {
            if (value === null || value === undefined || value === "") {
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
        partnerId: null,
        period: "all_time",
        page: "1",
    })
    const resultsSummaryParts = [`${totalProjects} results`, `Status: ${queryStatus}`]
    if (payment !== "All") resultsSummaryParts.push(`Payment: ${selectedPaymentLabel}`)
    if (recurring !== "All") resultsSummaryParts.push(`Type: ${selectedRecurringLabel}`)
    if (filteredPartner) resultsSummaryParts.push(`Partner: ${filteredPartner.name}`)
    if (period !== "all_time") resultsSummaryParts.push(`Period: ${selectedPeriodLabel}`)
    const resultsSummary = resultsSummaryParts.join(" · ")

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
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-sm">
                                    <Briefcase className="h-5 w-5" strokeWidth={1.8} />
                                </div>
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
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] text-slate-500 font-semibold" title={resultsSummary}>
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                <span>{totalProjects} results</span>
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
                                        title={`Remove ${filter.label}`}
                                    >
                                        <span className="max-w-[180px] truncate">{filter.label}</span>
                                        <X className="h-3 w-3 text-slate-400" />
                                    </Link>
                                ))}
                            </div>
                        )}

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
                            <div className="flex flex-wrap items-end gap-4">
                                <div className={cn("space-y-1.5", mobileFiltersOpen && "hidden md:block")}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Payment</p>
                                    <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                                        {paymentOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ payment: option.value, page: "1" })}
                                                className={cn(
                                                    "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
                                                    payment === option.value && option.value === "Paid" && "bg-[#10B981] text-white shadow-sm ring-1 ring-[#059669]",
                                                    payment === option.value && option.value === "Unpaid" && "bg-[#E11D48] text-white shadow-sm ring-1 ring-[#BE123C]",
                                                    payment === option.value && option.value === "All" && "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300",
                                                    payment !== option.value && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                <div className={cn("space-y-1.5", mobileFiltersOpen && "hidden md:block")}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                                    <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                                        {statusOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ status: option.value, page: "1" })}
                                                className={cn(
                                                    "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
                                                    queryStatus === option.value && option.value === "Active" && "bg-[#2563EB] text-white shadow-sm ring-1 ring-[#1D4ED8]",
                                                    queryStatus === option.value && option.value === "Completed" && "bg-[#10B981] text-white shadow-sm ring-1 ring-[#059669]",
                                                    queryStatus === option.value && option.value === "Closed" && "bg-slate-700 text-white shadow-sm ring-1 ring-slate-600",
                                                    queryStatus === option.value && option.value === "All" && "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300",
                                                    queryStatus !== option.value && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Type</p>
                                    <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                                        {recurringOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ recurring: option.value, page: "1" })}
                                                className={cn(
                                                    "inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-all",
                                                    recurring === option.value && option.value === "Recurring" && "bg-[#2563EB] text-white shadow-sm ring-1 ring-[#1D4ED8]",
                                                    recurring === option.value && option.value === "OneTime" && "bg-[#F59E0B] text-white shadow-sm ring-1 ring-[#D97706]",
                                                    recurring === option.value && option.value === "All" && "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300",
                                                    recurring !== option.value && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                <div className="ml-auto flex flex-wrap items-end gap-2">
                                    <PartnerFilterCombobox partners={partnersList} currentPartnerId={partnerId} />

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] transition-colors",
                                                    period !== "all_time"
                                                        ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                                                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                                )}
                                            >
                                                <CalendarDays className={cn("h-4 w-4", period !== "all_time" ? "text-[#3B82F6]" : "text-slate-400")} />
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

                                    <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] text-slate-500 font-semibold" title={resultsSummary}>
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline max-w-[420px] truncate">{resultsSummary}</span>
                                        <span className="xl:hidden">{totalProjects} results</span>
                                    </div>
                                </div>
                            </div>

                            {activeFilters.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Active filters</span>
                                    {activeFilters.map((filter) => (
                                        <Link
                                            key={filter.key}
                                            href={filter.href}
                                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-2.5 pr-2 text-[11px] font-medium text-slate-700 hover:bg-white"
                                            title={`Remove ${filter.label}`}
                                        >
                                            <span className="max-w-[180px] truncate">{filter.label}</span>
                                            <X className="h-3 w-3 text-slate-400" />
                                        </Link>
                                    ))}
                                    <Link
                                        href={clearAllHref}
                                        className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
