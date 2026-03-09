import prisma from "@/lib/prisma"
import Link from "next/link"
import {
    CalendarDays,
    ChevronDown,
    Grid2x2,
    List,
    Search,
    SlidersHorizontal,
    Users,
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
import { requireTenantContext } from "@/lib/tenant"
import { Prisma } from "@prisma/client"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { ProjectsBoardRows } from "@/components/projects/projects-board-rows"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 24

const statusOptions = [
    { label: "All", value: "All" },
    { label: "Active", value: "Active" },
    { label: "Paused", value: "Paused" },
    { label: "Completed", value: "Completed" },
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
        layout?: string
        page?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const queryStatus = params.status || "Active"
    const q = params.q?.trim()
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"
    const period = params.period || "all_time"
    const layout = params.layout || "list"
    const page = Math.max(1, Number(params.page) || 1)

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
            queryStatus === "All" ? {} : { status: queryStatus },
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

    const [projectsRaw, totalProjects, partnersFullRaw, servicesRaw] = await Promise.all([
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
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.project.count({ where: projectWhere }),
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

    const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildHref = (overrides: Record<string, string | null | undefined>) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (queryStatus) next.set("status", queryStatus)
        if (partnerId) next.set("partnerId", partnerId)
        if (payment) next.set("payment", payment)
        if (recurring) next.set("recurring", recurring)
        if (period) next.set("period", period)
        if (layout) next.set("layout", layout)
        next.set("page", String(page))

        for (const [key, value] of Object.entries(overrides)) {
            if (value === null || value === undefined || value === "") {
                next.delete(key)
            } else {
                next.set(key, value)
            }
        }

        if (!next.get("page")) {
            next.set("page", "1")
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

    return (
        <ProjectSheetWrapper projects={projectsForClient} allServices={servicesForClient}>
            <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-[180px]">
                        <MobileMenuTrigger />
                        <h1 className="page-title text-slate-900">Projects</h1>
                    </div>

                    <form className="relative flex-1 min-w-0" action="/projects" method="get">
                        {queryStatus && <input type="hidden" name="status" value={queryStatus} />}
                        {payment && <input type="hidden" name="payment" value={payment} />}
                        {recurring && <input type="hidden" name="recurring" value={recurring} />}
                        {period && <input type="hidden" name="period" value={period} />}
                        {partnerId && <input type="hidden" name="partnerId" value={partnerId} />}
                        {layout && <input type="hidden" name="layout" value={layout} />}
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            name="q"
                            defaultValue={q || ""}
                            placeholder="Search projects, clients or campaigns..."
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                    </form>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                            <Link
                                href={buildHref({ layout: "list", page: "1" })}
                                className={cn(
                                    "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                                    layout === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                <List className="h-4 w-4" />
                            </Link>
                            <Link
                                href={buildHref({ layout: "grid", page: "1" })}
                                className={cn(
                                    "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                                    layout === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                <Grid2x2 className="h-4 w-4" />
                            </Link>
                        </div>

                        <CreateProjectButton
                            variant="full"
                            label="Add Project"
                            partners={partnersForClient}
                            services={servicesForClient}
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 md:px-4 md:py-4 shadow-sm">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                                {statusOptions.map((option) => (
                                    <Link
                                        key={option.value}
                                        href={buildHref({ status: option.value, page: "1" })}
                                        className={cn(
                                            "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-all",
                                            queryStatus === option.value && option.value === "Active" && "bg-[#DBEAFE] text-[#1D4ED8] ring-1 ring-[#93C5FD]",
                                            queryStatus === option.value && option.value === "Paused" && "bg-[#FEF3C7] text-[#B45309] ring-1 ring-[#FCD34D]",
                                            queryStatus === option.value && option.value === "Completed" && "bg-[#D1FAE5] text-[#047857] ring-1 ring-[#6EE7B7]",
                                            queryStatus === option.value && option.value === "All" && "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200",
                                            queryStatus !== option.value && "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                        )}
                                    >
                                        {option.label}
                                    </Link>
                                ))}
                            </div>

                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                <details className="group relative">
                                    <summary className={cn(
                                        "list-none inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] cursor-pointer transition-colors",
                                        recurring !== "All"
                                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                    )}>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Type</span>
                                        <span className="font-medium">{selectedRecurringLabel}</span>
                                        <ChevronDown className="h-4 w-4 opacity-70 transition group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute left-0 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                        {recurringOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ recurring: option.value, page: "1" })}
                                                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </details>

                                <details className="group relative">
                                    <summary className={cn(
                                        "list-none inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] cursor-pointer transition-colors",
                                        payment !== "All"
                                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                    )}>
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Payment</span>
                                        <span className="font-medium">{selectedPaymentLabel}</span>
                                        <ChevronDown className="h-4 w-4 opacity-70 transition group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute left-0 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                        {paymentOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ payment: option.value, page: "1" })}
                                                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </details>

                                <details className="group relative">
                                <summary className={cn(
                                    "list-none inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] cursor-pointer transition-colors",
                                    partnerId
                                        ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                )}>
                                    <Users className={cn("h-4 w-4", partnerId ? "text-[#3B82F6]" : "text-slate-400")} />
                                    <span className="max-w-[180px] truncate">{filteredPartner?.name || "Partner"}</span>
                                    <ChevronDown className="h-4 w-4 opacity-70 transition group-open:rotate-180" />
                                </summary>
                                <div className="absolute left-0 top-11 z-20 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                    <Link href={buildHref({ partnerId: null, page: "1" })} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                        All partners
                                    </Link>
                                    <div className="my-1 h-px bg-slate-100" />
                                    <div className="max-h-72 overflow-y-auto pr-1">
                                        {partnersList.map((partner) => (
                                            <Link
                                                key={partner.id}
                                                href={buildHref({ partnerId: partner.id, page: "1" })}
                                                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                {partner.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                                </details>

                                <details className="group relative">
                                    <summary className={cn(
                                        "list-none inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] cursor-pointer transition-colors",
                                        period !== "all_time"
                                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                                    )}>
                                        <CalendarDays className={cn("h-4 w-4", period !== "all_time" ? "text-[#3B82F6]" : "text-slate-400")} />
                                        <span>{selectedPeriodLabel}</span>
                                        <ChevronDown className="h-4 w-4 opacity-70 transition group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute left-0 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                        {periodOptions.map((option) => (
                                            <Link
                                                key={option.value}
                                                href={buildHref({ period: option.value, page: "1" })}
                                                className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            >
                                                {option.label}
                                            </Link>
                                        ))}
                                    </div>
                                </details>

                                <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] uppercase tracking-[0.1em] text-slate-500 font-semibold">
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    {totalProjects} results
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

            <ProjectsBoardRows projects={projectsForClient} layout={layout as "grid" | "list"} />

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
            </div>
        </ProjectSheetWrapper>
    )
}
