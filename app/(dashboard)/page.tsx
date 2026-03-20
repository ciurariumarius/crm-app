import Link from "next/link"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { CirclePlus, FolderPlus, WalletCards, BadgeCheck, Timer } from "lucide-react"
import { GlobalSearch } from "@/components/dashboard/global-search"
import {
    HomeRevenueDistributionChart,
    type RevenueAnalysisEntry,
    type RevenuePeriodDataset,
    type RevenuePeriodKey,
} from "@/components/dashboard/home-revenue-distribution-chart"
import { HomeTaskColumns } from "@/components/dashboard/home-task-columns"
import {
    formatCurrency,
    formatNumber,
    formatProjectServiceList,
    serialize,
} from "@/lib/utils"

export const dynamic = "force-dynamic"

type HomeProject = {
    id: string
    currentFee: number | null
    createdAt: Date
    site: {
        domainName: string | null
        partner: { id: string; name: string } | null
    } | null
    services: Array<{ serviceName: string | null; isRecurring: boolean }>
}

type RecurringFamilyMeta = {
    key: string
    label: string
    partnerName: string
    domainName: string
}

function normalizeDomainName(value: string | null | undefined) {
    const normalized = (value || "").trim()
    return normalized || "Unknown Domain"
}

function normalizeServiceKey(
    services: Array<{ serviceName: string | null; isRecurring: boolean }>
) {
    const serviceNames = services
        .map((service) => (service.serviceName || "").trim().toLowerCase())
        .filter(Boolean)
        .sort()
    return serviceNames.join("|")
}

function getQuarterStart(date: Date) {
    const quarter = Math.floor(date.getMonth() / 3)
    return new Date(date.getFullYear(), quarter * 3, 1)
}

function getPeriodRanges(now: Date): Record<RevenuePeriodKey, { start?: Date; end?: Date }> {
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const thisQuarterStart = getQuarterStart(now)
    const nextQuarterStart = new Date(thisQuarterStart.getFullYear(), thisQuarterStart.getMonth() + 3, 1)
    const thisYearStart = new Date(now.getFullYear(), 0, 1)
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1)

    return {
        all_time: {},
        this_month: { start: thisMonthStart },
        last_month: { start: lastMonthStart, end: thisMonthStart },
        this_quarter: { start: thisQuarterStart, end: nextQuarterStart },
        this_year: { start: thisYearStart, end: nextYearStart },
    }
}

function isInRange(date: Date, range: { start?: Date; end?: Date }) {
    if (range.start && date < range.start) return false
    if (range.end && date >= range.end) return false
    return true
}

function toSortedRows(map: Map<string, RevenueAnalysisEntry>) {
    return Array.from(map.values())
        .filter((entry) => entry.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
}

function resolveRecurringFamily(project: HomeProject): RecurringFamilyMeta {
    const domainName = normalizeDomainName(project.site?.domainName)
    const serviceKey = normalizeServiceKey(project.services)
    const serviceList = formatProjectServiceList(project.services, "No Service")
    return {
        key: `recurring:${domainName}:${serviceKey}`,
        label: `${domainName} - ${serviceList}`,
        partnerName: project.site?.partner?.name || "Unknown Partner",
        domainName,
    }
}

export default async function HomePage() {
    const session = await requireTenantContext()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const [
        user,
        activeProjectsCount,
        activeRecurringProjectsCount,
        activeOneTimeProjectsCount,
        activeTasksCount,
        monthRevenueAggregate,
        unpaidRevenueAggregate,
        monthTimeAggregate,
        urgentTasksRaw,
        overdueTasksRaw,
        projectsRaw,
        monthTimeByProjectRaw,
    ] = await Promise.all([
        prisma.user.findFirst({
            where: { id: session.userId, tenantId: session.tenantId },
            select: { name: true, username: true },
        }),
        prisma.project.count({
            where: { tenantId: session.tenantId, status: "Active" },
        }),
        prisma.project.count({
            where: {
                tenantId: session.tenantId,
                status: "Active",
                services: { some: { isRecurring: true } },
            },
        }),
        prisma.project.count({
            where: {
                tenantId: session.tenantId,
                status: "Active",
                services: { none: { isRecurring: true } },
            },
        }),
        prisma.task.count({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
            },
        }),
        prisma.project.aggregate({
            where: {
                tenantId: session.tenantId,
                createdAt: { gte: monthStart },
            },
            _sum: { currentFee: true },
        }),
        prisma.project.aggregate({
            where: { tenantId: session.tenantId, paymentStatus: "Unpaid" },
            _sum: { currentFee: true },
        }),
        prisma.timeLog.aggregate({
            where: {
                tenantId: session.tenantId,
                startTime: { gte: monthStart },
            },
            _sum: { durationSeconds: true },
        }),
        prisma.task.findMany({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                urgency: { in: ["Urgent", "High"] },
            },
            orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
            take: 100,
            select: {
                id: true,
                projectId: true,
                name: true,
                description: true,
                status: true,
                urgency: true,
                deadline: true,
                createdAt: true,
                updatedAt: true,
                timeLogs: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        durationSeconds: true,
                    },
                },
                project: {
                    select: {
                        id: true,
                        createdAt: true,
                        site: { select: { id: true, domainName: true, partner: { select: { id: true, name: true } } } },
                        services: { select: { serviceName: true, isRecurring: true } },
                        tasks: {
                            select: {
                                id: true,
                                name: true,
                                timeLogs: {
                                    select: {
                                        id: true,
                                        startTime: true,
                                        endTime: true,
                                        durationSeconds: true,
                                    },
                                },
                            },
                        },
                        timeLogs: {
                            select: {
                                id: true,
                                startTime: true,
                                endTime: true,
                                durationSeconds: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.task.findMany({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                deadline: { not: null, lt: todayStart },
            },
            orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
            take: 100,
            select: {
                id: true,
                projectId: true,
                name: true,
                description: true,
                status: true,
                urgency: true,
                deadline: true,
                createdAt: true,
                updatedAt: true,
                timeLogs: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        durationSeconds: true,
                    },
                },
                project: {
                    select: {
                        id: true,
                        createdAt: true,
                        site: { select: { id: true, domainName: true, partner: { select: { id: true, name: true } } } },
                        services: { select: { serviceName: true, isRecurring: true } },
                        tasks: {
                            select: {
                                id: true,
                                name: true,
                                timeLogs: {
                                    select: {
                                        id: true,
                                        startTime: true,
                                        endTime: true,
                                        durationSeconds: true,
                                    },
                                },
                            },
                        },
                        timeLogs: {
                            select: {
                                id: true,
                                startTime: true,
                                endTime: true,
                                durationSeconds: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            select: {
                id: true,
                currentFee: true,
                createdAt: true,
                site: {
                    select: {
                        domainName: true,
                        partner: { select: { id: true, name: true } },
                    },
                },
                services: {
                    select: {
                        serviceName: true,
                        isRecurring: true,
                    },
                },
            },
        }),
        prisma.timeLog.groupBy({
            by: ["projectId"],
            where: {
                tenantId: session.tenantId,
                startTime: { gte: monthStart },
            },
            _sum: { durationSeconds: true },
        }),
    ])

    const monthRevenue = Number(monthRevenueAggregate._sum.currentFee || 0)
    const unpaidRevenue = Number(unpaidRevenueAggregate._sum.currentFee || 0)
    const monthHours = Number(monthTimeAggregate._sum.durationSeconds || 0) / 3600
    const urgentTasksCount = urgentTasksRaw.length
    const overdueTasksCount = overdueTasksRaw.length
    const monthHoursByProject = new Map(
        monthTimeByProjectRaw.map((entry) => [
            entry.projectId,
            (Number(entry._sum.durationSeconds || 0) || 0) / 3600,
        ])
    )

    const allProjects = projectsRaw as HomeProject[]
    const recurringProjects = allProjects.filter((project) =>
        project.services.some((service) => service.isRecurring)
    )

    const allTimeHoursByFamily = new Map<string, number>()
    for (const project of recurringProjects) {
        const family = resolveRecurringFamily(project)
        allTimeHoursByFamily.set(
            family.key,
            (allTimeHoursByFamily.get(family.key) || 0) + (monthHoursByProject.get(project.id) || 0)
        )
    }

    const periodRanges = getPeriodRanges(now)
    const periodMaps: Record<
        RevenuePeriodKey,
        {
            totalRevenue: number
            partner: Map<string, RevenueAnalysisEntry>
            domain: Map<string, RevenueAnalysisEntry>
            project: Map<string, RevenueAnalysisEntry>
        }
    > = {
        all_time: { totalRevenue: 0, partner: new Map(), domain: new Map(), project: new Map() },
        this_month: { totalRevenue: 0, partner: new Map(), domain: new Map(), project: new Map() },
        last_month: { totalRevenue: 0, partner: new Map(), domain: new Map(), project: new Map() },
        this_quarter: { totalRevenue: 0, partner: new Map(), domain: new Map(), project: new Map() },
        this_year: { totalRevenue: 0, partner: new Map(), domain: new Map(), project: new Map() },
    }

    for (const project of recurringProjects) {
        const fee = Number(project.currentFee || 0)
        if (fee <= 0) continue

        const createdAt = new Date(project.createdAt)
        const family = resolveRecurringFamily(project)

        for (const periodKey of Object.keys(periodMaps) as RevenuePeriodKey[]) {
            const range = periodRanges[periodKey]
            if (!isInRange(createdAt, range)) continue

            const bucket = periodMaps[periodKey]
            bucket.totalRevenue += fee

            const partnerName = family.partnerName
            const domainName = family.domainName

            const partnerEntry = bucket.partner.get(partnerName) || {
                key: partnerName,
                label: partnerName,
                revenue: 0,
            }
            partnerEntry.revenue += fee
            bucket.partner.set(partnerName, partnerEntry)

            const domainEntry = bucket.domain.get(domainName) || {
                key: domainName,
                label: domainName,
                revenue: 0,
            }
            domainEntry.revenue += fee
            bucket.domain.set(domainName, domainEntry)

            const projectEntry = bucket.project.get(family.key) || {
                key: family.key,
                label: family.label,
                revenue: 0,
                hoursThisMonth: allTimeHoursByFamily.get(family.key) || 0,
            }
            projectEntry.revenue += fee
            bucket.project.set(family.key, projectEntry)
        }
    }

    const periodData = (Object.keys(periodMaps) as RevenuePeriodKey[]).reduce(
        (acc, periodKey) => {
            const bucket = periodMaps[periodKey]
            acc[periodKey] = {
                totalRevenue: bucket.totalRevenue,
                partner: toSortedRows(bucket.partner),
                domain: toSortedRows(bucket.domain),
                project: toSortedRows(bucket.project),
            }
            return acc
        },
        {} as Record<RevenuePeriodKey, RevenuePeriodDataset>
    )

    const displayName = user?.name?.split(" ")[0] || user?.username || "Marius"

    return (
        <div className="flex flex-col gap-6 pb-10">
            <section className="space-y-4">
                <div className="flex items-start justify-between gap-4 md:hidden">
                    <div className="flex items-start gap-3">
                        <MobileMenuTrigger />
                        <div>
                            <h1 className="ui-text-title text-slate-900">Overview</h1>
                            <p className="mt-1 text-sm text-slate-500">Good morning, {displayName}</p>
                        </div>
                    </div>
                    <GlobalSearch />
                </div>

                <div className="hidden items-start justify-between gap-4 md:flex">
                    <div>
                        <h1 className="ui-text-title text-slate-900">Overview</h1>
                        <p className="mt-1 text-sm text-slate-500">Good morning, {displayName}</p>
                    </div>
                    <div className="flex-1 min-w-[280px] px-2">
                        <GlobalSearch />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                            href="/tasks"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                        >
                            <CirclePlus className="h-3.5 w-3.5" />
                            Add Task
                        </Link>
                        <Link
                            href="/projects"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100/70"
                        >
                            <FolderPlus className="h-3.5 w-3.5" />
                            Add Project
                        </Link>
                        <Link
                            href="/payments"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100/70"
                        >
                            <WalletCards className="h-3.5 w-3.5" />
                            Add Payment
                        </Link>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Revenue</p>
                            <WalletCards className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-rose-600">Unpaid</p>
                                <p className="mt-1 text-[30px] font-bold leading-none tracking-tight text-rose-600">{formatCurrency(unpaidRevenue)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-600">This month</p>
                                <p className="mt-1 text-sm font-bold leading-none text-slate-700">{formatCurrency(monthRevenue)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Active projects</p>
                            <FolderPlus className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-4">
                            <div>
                                <p className="text-[36px] font-bold leading-none tracking-tight text-slate-900">{formatNumber(activeProjectsCount)}</p>
                                <p className="mt-1 text-[10px] font-medium italic text-slate-400">Total</p>
                            </div>
                            <div className="space-y-1.5 border-l border-slate-100 pl-3">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-violet-600">Recurring</span>
                                    <span className="font-bold text-violet-700">{formatNumber(activeRecurringProjectsCount)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-emerald-600">One-time</span>
                                    <span className="font-bold text-emerald-700">{formatNumber(activeOneTimeProjectsCount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tasks overview</p>
                            <BadgeCheck className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-4">
                            <div>
                                <p className="text-[36px] font-bold leading-none tracking-tight text-slate-900">{formatNumber(activeTasksCount)}</p>
                                <p className="mt-1 text-[10px] font-medium italic text-slate-400">Total</p>
                            </div>
                            <div className="space-y-1.5 border-l border-slate-100 pl-3">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-amber-600">Overdue</span>
                                    <span className="font-bold text-amber-700">{formatNumber(overdueTasksCount)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-semibold uppercase tracking-[0.08em] text-rose-600">Urgent</span>
                                    <span className="font-bold text-rose-700">{formatNumber(urgentTasksCount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hours worked</p>
                            <Timer className="h-4 w-4 text-slate-300" />
                        </div>
                        <p className="mt-4 text-[36px] font-bold leading-none tracking-tight text-slate-900">{formatNumber(Math.round(monthHours))}</p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600">This month</p>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">My Tasks</h3>
                <HomeTaskColumns
                    urgentTasks={serialize(urgentTasksRaw)}
                    overdueTasks={serialize(overdueTasksRaw)}
                />
            </section>

            <HomeRevenueDistributionChart periodData={periodData} />
        </div>
    )
}
