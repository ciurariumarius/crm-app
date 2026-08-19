import type { ReactNode } from "react"
import Link from "next/link"
import { Banknote, WalletCards } from "lucide-react"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { getLmsOwnerCapacitySummary } from "@/lib/lms-tasks/db"
import type { LmsOwnerPeriodSummary } from "@/lib/lms-tasks/owner-summary"
import { getBucharestDateOnly } from "@/lib/lms-work-entries/date"
import {
    buildHomeBucharestMonthRange,
    buildHomeBilledRevenueWhere,
    buildHomeLmsAnalysisHref,
    buildHomeOpenTasksQuery,
    buildHomeUnpaidWhere,
} from "@/lib/homepage"
import { formatCurrency, serialize } from "@/lib/utils"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { GlobalSearch } from "@/components/dashboard/global-search"
import { HomeHeaderActions } from "@/components/dashboard/home-header-actions"
import { HomeTaskColumns } from "@/components/dashboard/home-task-columns"
import { StatCard } from "@/components/ui/app-surface"
import { Progress } from "@/components/ui/progress"
import { LmsIcon } from "@/components/lms/lms-icon"

export const dynamic = "force-dynamic"

function formatHours(minutes: number) {
    const hours = Math.max(0, minutes) / 60
    return `${new Intl.NumberFormat("ro-RO", {
        minimumFractionDigits: Number.isInteger(hours) ? 0 : 1,
        maximumFractionDigits: 1,
    }).format(hours)}h`
}

function formatDataDate(value: string | null) {
    if (!value) return null
    const parsed = new Date(`${value}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return null
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsed)
}

function MetricCardLink({
    href,
    label,
    value,
    caption,
    icon,
    valueClassName = "text-[var(--text-primary)]",
}: {
    href: string
    label: string
    value: string
    caption: string
    icon: ReactNode
    valueClassName?: string
}) {
    return (
        <Link
            href={href}
            className="group block h-full rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_34%,transparent)]"
            aria-label={`${label}: ${value}`}
        >
            <StatCard className="min-h-[144px] transition-[border-color,transform,box-shadow] group-hover:-translate-y-0.5 group-hover:border-[color:color-mix(in_srgb,var(--line-subtle)_62%,var(--text-muted)_38%)]">
                <div className="flex h-full min-h-[110px] flex-col">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline">{label}</p>
                        <span className="text-[var(--text-muted)]">{icon}</span>
                    </div>
                    <div className="mt-auto pt-5">
                        <p className={`ui-text-metric text-[28px] leading-none sm:text-[32px] ${valueClassName}`}>
                            {value}
                        </p>
                        <p className="ui-text-caption mt-2 text-[var(--text-muted)]">{caption}</p>
                    </div>
                </div>
            </StatCard>
        </Link>
    )
}

function LmsCapacityCard({
    label,
    href,
    period,
    latestTaskDate,
}: {
    label: string
    href: string
    period: LmsOwnerPeriodSummary
    latestTaskDate: string | null
}) {
    const utilization = period.capacityMinutes > 0 ? period.utilizationPercent : null
    const latestLabel = formatDataDate(latestTaskDate)
    const freshness = period.loggedMinutes === 0
        ? latestLabel
            ? `No logs in this period · Data through ${latestLabel}`
            : "No logs in this period"
        : latestLabel
            ? `Data through ${latestLabel}`
            : "Current LMS task logs"

    return (
        <Link
            href={href}
            className="group block h-full rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_34%,transparent)]"
            aria-label={`${label}: ${formatHours(period.loggedMinutes)} of ${formatHours(period.capacityMinutes)}`}
        >
            <StatCard className="min-h-[144px] transition-[border-color,transform,box-shadow] group-hover:-translate-y-0.5 group-hover:border-[color:color-mix(in_srgb,var(--line-subtle)_62%,var(--text-muted)_38%)]">
                <div className="flex items-start justify-between gap-3">
                    <p className="ui-overline">{label}</p>
                    <LmsIcon className="h-5 w-5" />
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="ui-text-metric text-[24px] leading-none text-[var(--text-primary)] sm:text-[28px]">
                        {formatHours(period.loggedMinutes)}
                        <span className="ml-1.5 text-sm font-semibold text-[var(--text-muted)]">
                            / {formatHours(period.capacityMinutes)}
                        </span>
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--brand-primary)]">
                        {utilization === null ? "—" : `${utilization.toFixed(1)}%`}
                    </p>
                </div>

                <Progress
                    value={Math.min(100, Math.max(0, utilization ?? 0))}
                    className="mt-3 h-2"
                    aria-label={`${label} capacity utilization`}
                />
                <p className="ui-text-caption mt-2 truncate text-[var(--text-muted)]">{freshness}</p>
            </StatCard>
        </Link>
    )
}

export default async function HomePage() {
    await requireAuth()
    const asOf = getBucharestDateOnly()
    const billedRange = buildHomeBucharestMonthRange(asOf)
    const billedRevenueWhere = buildHomeBilledRevenueWhere({
        gte: billedRange.gte,
        lt: billedRange.lt,
    })
    const unpaidWhere = buildHomeUnpaidWhere()
    const openTasksQuery = buildHomeOpenTasksQuery()

    const [
        allServicesRaw,
        partnersForDialogsRaw,
        projectsForDialogsRaw,
        monthRevenueAggregate,
        unpaidRevenueAggregate,
        unpaidProjectsCount,
        openTasksRaw,
        totalOpenTasks,
        lmsSummary,
    ] = await Promise.all([
        prisma.service.findMany({ orderBy: { serviceName: "asc" } }),
        prisma.partner.findMany({
            include: {
                sites: {
                    select: {
                        id: true,
                        domainName: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        prisma.project.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                site: { select: { domainName: true } },
                services: { select: { serviceName: true, isRecurring: true } },
            },
            orderBy: { updatedAt: "desc" },
        }),
        prisma.project.aggregate({
            where: billedRevenueWhere,
            _sum: { currentFee: true },
        }),
        prisma.project.aggregate({
            where: unpaidWhere,
            _sum: { currentFee: true },
        }),
        prisma.project.count({ where: unpaidWhere }),
        prisma.task.findMany({
            ...openTasksQuery,
        }),
        prisma.task.count({ where: openTasksQuery.where }),
        getLmsOwnerCapacitySummary(asOf),
    ])

    const monthRevenue = Number(monthRevenueAggregate._sum.currentFee || 0)
    const unpaidRevenue = Number(unpaidRevenueAggregate._sum.currentFee || 0)
    const homeDialogPartners = serialize(partnersForDialogsRaw)
    const homeDialogServices = serialize(allServicesRaw)
    const homeDialogProjects = serialize(
        projectsForDialogsRaw.map((project) => ({
            id: project.id,
            status: project.status || "Active",
            createdAt: project.createdAt,
            site: { domainName: project.site.domainName },
            services: project.services,
        }))
    )
    const monthLmsHref = buildHomeLmsAnalysisHref({
        period: "this-month",
        employeeName: lmsSummary.employeeName,
        from: lmsSummary.month.from,
        to: lmsSummary.month.to,
    })
    const quarterLmsHref = buildHomeLmsAnalysisHref({
        period: "this-quarter",
        employeeName: lmsSummary.employeeName,
        from: lmsSummary.quarter.from,
        to: lmsSummary.quarter.to,
    })

    return (
        <div className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10">
            <AppPageHeader
                title="Overview"
                search={<GlobalSearch desktopTriggerClassName="mx-auto w-full max-w-[640px]" />}
                mobileSearch={<GlobalSearch mobileMode="full" />}
            />

            <HomeHeaderActions
                partners={homeDialogPartners}
                services={homeDialogServices}
                projects={homeDialogProjects}
            />

            <section aria-label="Business overview" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5">
                <MetricCardLink
                    href="/payments#revenue-analysis"
                    label="This month revenue"
                    value={formatCurrency(monthRevenue)}
                    caption="Billed work · paid and unpaid"
                    icon={<Banknote className="h-5 w-5" />}
                />

                <MetricCardLink
                    href="/payments#outstanding"
                    label="Total unpaid"
                    value={formatCurrency(unpaidRevenue)}
                    caption={`${unpaidProjectsCount} open ${unpaidProjectsCount === 1 ? "item" : "items"}`}
                    icon={<WalletCards className="h-5 w-5" />}
                    valueClassName={unpaidRevenue > 0 ? "text-[var(--state-urgent)]" : "text-[var(--state-success)]"}
                />

                <LmsCapacityCard
                    href={monthLmsHref}
                    label="LMS this month"
                    period={lmsSummary.month}
                    latestTaskDate={lmsSummary.latestTaskDate}
                />

                <LmsCapacityCard
                    href={quarterLmsHref}
                    label="LMS this quarter"
                    period={lmsSummary.quarter}
                    latestTaskDate={lmsSummary.latestTaskDate}
                />
            </section>

            <HomeTaskColumns
                tasks={serialize(openTasksRaw)}
                totalOpenTasks={totalOpenTasks}
            />
        </div>
    )
}
