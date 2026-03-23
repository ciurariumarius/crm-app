import Link from "next/link"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { CirclePlus, FolderPlus, WalletCards, BadgeCheck, Timer, Banknote } from "lucide-react"
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
    formatProjectServiceList,
    serialize,
} from "@/lib/utils"

export const dynamic = "force-dynamic"

type HomeProject = {
    id: string
    currentFee: number | null
    createdAt: Date
    site: {
        id: string
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
    const nowMs = now.getTime()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const currentMonthLabel = format(now, "MMMM yyyy")
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const [
        user,
        allServicesRaw,
        activeProjectsCount,
        activeRecurringProjectsCount,
        activeOneTimeProjectsCount,
        activeTasksCount,
        monthRevenueAggregate,
        unpaidRevenueAggregate,
        monthTimeAggregate,
        runningMonthLogs,
        urgentTasksRaw,
        overdueTasksRaw,
        projectsRaw,
        monthTimeByProjectRaw,
    ] = await Promise.all([
        prisma.user.findFirst({
            where: { id: session.userId, tenantId: session.tenantId },
            select: { name: true, username: true, hourlyRate: true },
        }),
        prisma.service.findMany({
            where: { tenantId: session.tenantId },
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
                OR: [
                    { createdAt: { gte: monthStart, lt: nextMonthStart } },
                    {
                        services: { some: { isRecurring: true } },
                        name: { contains: currentMonthLabel },
                    },
                ],
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
                startTime: { gte: monthStart, lt: nextMonthStart },
            },
            _sum: { durationSeconds: true },
        }),
        prisma.timeLog.findMany({
            where: {
                tenantId: session.tenantId,
                startTime: { gte: monthStart, lt: nextMonthStart },
                endTime: null,
            },
            select: {
                startTime: true,
            },
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
                        id: true,
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
                startTime: { gte: monthStart, lt: nextMonthStart },
            },
            _sum: { durationSeconds: true },
        }),
    ])

    const monthRevenue = Number(monthRevenueAggregate._sum.currentFee || 0)
    const unpaidRevenue = Number(unpaidRevenueAggregate._sum.currentFee || 0)
    const monthHoursFromCompletedLogs = Number(monthTimeAggregate._sum.durationSeconds || 0)
    const runningMonthSeconds = runningMonthLogs.reduce((sum, log) => {
        const startedAtMs = new Date(log.startTime).getTime()
        const elapsed = Number.isFinite(startedAtMs)
            ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
            : 0
        return sum + elapsed
    }, 0)
    const monthHours = (monthHoursFromCompletedLogs + runningMonthSeconds) / 3600
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

            const partnerId = project.site?.partner?.id || family.partnerName
            const partnerName = family.partnerName
            const domainId = project.site?.id || family.domainName
            const domainName = family.domainName

            const partnerEntry = bucket.partner.get(partnerId) || {
                key: partnerId,
                label: partnerName,
                revenue: 0,
                openPartnerId: project.site?.partner?.id,
            }
            partnerEntry.revenue += fee
            bucket.partner.set(partnerId, partnerEntry)

            const domainEntry = bucket.domain.get(domainId) || {
                key: domainId,
                label: domainName,
                revenue: 0,
                openSiteId: project.site?.id,
                openPartnerId: project.site?.partner?.id,
            }
            domainEntry.revenue += fee
            bucket.domain.set(domainId, domainEntry)

            const projectEntry = bucket.project.get(family.key) || {
                key: family.key,
                label: family.label,
                revenue: 0,
                hoursThisMonth: allTimeHoursByFamily.get(family.key) || 0,
                openProjectId: project.id,
                openSiteId: project.site?.id,
                openPartnerId: project.site?.partner?.id,
                latestCreatedAtMs: createdAt.getTime(),
            }
            projectEntry.revenue += fee
            if ((projectEntry.latestCreatedAtMs || 0) < createdAt.getTime()) {
                projectEntry.openProjectId = project.id
                projectEntry.openSiteId = project.site?.id
                projectEntry.openPartnerId = project.site?.partner?.id
                projectEntry.latestCreatedAtMs = createdAt.getTime()
            }
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
    const hourlyRate = Number(user?.hourlyRate || 0)

    return (
        <div className="flex flex-col gap-10 pb-10">
            <section className="space-y-6">
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

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Revenue Card */}
                    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Revenue</p>
                            <Banknote className="h-8 w-8 text-slate-100 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Unpaid</p>
                                <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-rose-600">
                                    {formatCurrency(unpaidRevenue)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">This month</p>
                                <div className="mt-1 flex items-center justify-end gap-2">
                                    <p className="text-sm font-bold text-slate-800">{formatCurrency(monthRevenue)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Active Projects Card */}
                    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Active projects</p>
                            <FolderPlus className="h-8 w-8 text-slate-100 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end gap-6">
                            <div className="min-w-[60px]">
                                <p className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{activeProjectsCount}</p>
                                <p className="mt-1 text-[10px] italic text-slate-400">Total</p>
                            </div>
                            <div className="flex-1 space-y-2 border-l border-slate-100 pl-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-500">Recurring</span>
                                    <span className="text-sm font-bold text-slate-900">{activeRecurringProjectsCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">One-time</span>
                                    <span className="text-sm font-bold text-slate-900">{activeOneTimeProjectsCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Card */}
                    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Tasks overview</p>
                            <BadgeCheck className="h-8 w-8 text-slate-100 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end gap-6">
                            <div className="min-w-[60px]">
                                <p className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{activeTasksCount}</p>
                                <p className="mt-1 text-[10px] italic text-slate-400">Total</p>
                            </div>
                            <div className="flex-1 space-y-2 border-l border-slate-100 pl-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Overdue</span>
                                    <span className="text-sm font-bold text-slate-900">{overdueTasksCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Urgent</span>
                                    <span className="text-sm font-bold text-slate-900">{urgentTasksCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hours Card */}
                    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Hours worked</p>
                            <Timer className="h-8 w-8 text-slate-100 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6">
                            <p className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{monthHours.toFixed(1)}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-500">This month</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
                <HomeTaskColumns
                    urgentTasks={serialize(urgentTasksRaw)}
                    overdueTasks={serialize(overdueTasksRaw)}
                    allServices={serialize(allServicesRaw)}
                    hourlyRate={hourlyRate}
                />
            </section>

            <HomeRevenueDistributionChart
                periodData={periodData}
                allServices={serialize(allServicesRaw)}
                hourlyRate={hourlyRate}
            />
        </div>
    )
}
