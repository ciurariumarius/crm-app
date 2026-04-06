import Link from "next/link"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { FolderPlus, Timer, Banknote } from "lucide-react"
import { GlobalSearch } from "@/components/dashboard/global-search"
import { HomeHeaderActions } from "@/components/dashboard/home-header-actions"
import {
    HomeRevenueDistributionChart,
    type RevenueSourceProject,
} from "@/components/dashboard/home-revenue-distribution-chart"
import { HomeTaskColumns } from "@/components/dashboard/home-task-columns"
import {
    formatCurrency,
    formatProjectName,
    serialize,
} from "@/lib/utils"

export const dynamic = "force-dynamic"

type HomeProject = {
    id: string
    name?: string | null
    status?: string | null
    currentFee: number | null
    createdAt: Date
    site: {
        id: string
        domainName: string | null
        partner: { id: string; name: string } | null
    } | null
    services: Array<{ serviceName: string | null; isRecurring: boolean }>
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
        partnersForDialogsRaw,
        activeRecurringProjectsCount,
        activeOneTimeProjectsCount,
        completedTasksCount,
        monthRevenueAggregate,
        unpaidRevenueAggregate,
        monthTimeAggregate,
        runningMonthLogs,
        urgentTasksRaw,
        overdueTasksRaw,
        normalTasksRaw,
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
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
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
                status: "Completed",
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
        prisma.task.findMany({
            where: {
                tenantId: session.tenantId,
                status: { in: ["Active", "Paused"] },
                urgency: "Normal",
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
                name: true,
                status: true,
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
    const monthHoursByProject = new Map(
        monthTimeByProjectRaw.map((entry) => [
            entry.projectId,
            (Number(entry._sum.durationSeconds || 0) || 0) / 3600,
        ])
    )

    const allProjects = projectsRaw as HomeProject[]

    const revenueSourceProjects = serialize(
        allProjects
            .filter((project) => Number(project.currentFee || 0) > 0)
            .map((project) => ({
                id: project.id,
                currentFee: Number(project.currentFee || 0),
                createdAt: project.createdAt.toISOString(),
                revenueType: project.services.some((service) => service.isRecurring) ? "recurring" : "one-time",
                hoursThisMonth: monthHoursByProject.get(project.id) || 0,
                label: formatProjectName(project),
                site: project.site
                    ? {
                        id: project.site.id,
                        domainName: project.site.domainName,
                        partner: project.site.partner
                            ? {
                                id: project.site.partner.id,
                                name: project.site.partner.name,
                            }
                            : null,
                    }
                    : null,
                services: project.services.map((service) => ({
                    serviceName: service.serviceName,
                    isRecurring: service.isRecurring,
                })),
            })) as RevenueSourceProject[]
    )

    const hourlyRate = Number(user?.hourlyRate || 0)
    const homeDialogProjects = serialize(
        allProjects.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status || "Active",
            createdAt: project.createdAt,
            site: project.site ? { domainName: project.site.domainName || undefined } : undefined,
            services: project.services.map((service) => ({
                serviceName: service.serviceName || "",
                isRecurring: service.isRecurring,
            })),
        }))
    )
    const homeDialogPartners = serialize(partnersForDialogsRaw)
    const homeDialogServices = serialize(allServicesRaw)
    const unpaidProjectsHref = "/projects?status=All&payment=Unpaid"
    const thisMonthProjectsHref = "/projects?status=All&period=this_month"
    const kpiCardClassName = "relative h-full rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6"
    const kpiIconClassName = "absolute right-4 top-4 h-5 w-5 text-slate-200 sm:right-5 sm:top-5 sm:h-5.5 sm:w-5.5"

    return (
        <div className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10 lg:gap-10">
            <section className="space-y-5 sm:space-y-6">
                <div className="space-y-3 md:hidden">
                    <div className="flex items-start gap-3">
                        <div className="pt-1">
                            <MobileMenuTrigger />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="ui-text-title text-slate-900">Overview</h1>
                            <p className="mt-1 text-[13px] font-medium text-slate-500">
                                Snapshot of revenue, projects, and active work.
                            </p>
                        </div>
                    </div>
                    <GlobalSearch mobileMode="full" />
                    <HomeHeaderActions
                        partners={homeDialogPartners}
                        services={homeDialogServices}
                        projects={homeDialogProjects}
                        mobile
                    />
                </div>

                <div className="hidden items-start justify-between gap-4 md:flex">
                    <h1 className="ui-text-title text-slate-900">Overview</h1>
                    <div className="flex-1 min-w-[280px] px-2">
                        <GlobalSearch />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <HomeHeaderActions
                            partners={homeDialogPartners}
                            services={homeDialogServices}
                            projects={homeDialogProjects}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-5">
                    {/* This Month Revenue Card */}
                    <div className={kpiCardClassName}>
                        <div className="flex min-h-[102px] flex-col sm:min-h-[124px]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">This Month</p>
                            <Banknote className={kpiIconClassName} />
                            <Link
                                href={thisMonthProjectsHref}
                                className="group mt-auto inline-flex flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--primary-container)_35%,transparent)]"
                                aria-label="View this month projects"
                            >
                                <p className="text-[24px] font-bold leading-none tracking-tight text-slate-900 group-hover:text-[var(--primary)] sm:text-[32px]">
                                    {formatCurrency(monthRevenue)}
                                </p>
                                <p className="mt-1.5 text-[10px] font-medium text-slate-500 sm:mt-2 sm:text-[11px]">Current billed revenue</p>
                            </Link>
                        </div>
                    </div>

                    {/* Unpaid Revenue Card */}
                    <div className={kpiCardClassName}>
                        <div className="flex min-h-[102px] flex-col sm:min-h-[124px]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">Unpaid</p>
                            <Banknote className={kpiIconClassName} />
                            <Link
                                href={unpaidProjectsHref}
                                className="group mt-auto inline-flex flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                                aria-label="View unpaid projects"
                            >
                                <p className="text-[24px] font-bold leading-none tracking-tight text-rose-600 group-hover:text-rose-500 sm:text-[32px]">
                                    {formatCurrency(unpaidRevenue)}
                                </p>
                                <p className="mt-1.5 text-[10px] font-medium text-slate-500 sm:mt-2 sm:text-[11px]">Outstanding receivables</p>
                            </Link>
                        </div>
                    </div>

                    {/* Active Projects Card */}
                    <div className={kpiCardClassName}>
                        <div className="flex min-h-[102px] flex-col sm:min-h-[124px]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">Projects</p>
                            <FolderPlus className={kpiIconClassName} />
                            <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-3 pt-3 sm:gap-4 sm:pt-4">
                                <div className="min-w-0 text-center">
                                    <p className="text-[28px] font-bold leading-none tracking-tight text-violet-600 sm:text-[32px]">
                                        {activeRecurringProjectsCount}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:mt-1.5 sm:text-[11px]">
                                        Recurring
                                    </p>
                                </div>
                                <div className="h-8 w-px shrink-0 bg-slate-100 sm:h-9" />
                                <div className="min-w-0 text-center">
                                    <p className="text-[28px] font-bold leading-none tracking-tight text-emerald-600 sm:text-[32px]">
                                        {activeOneTimeProjectsCount}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:mt-1.5 sm:text-[11px]">
                                        One-time
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Work Card */}
                    <div className={kpiCardClassName}>
                        <div className="flex min-h-[102px] flex-col sm:min-h-[124px]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">Work</p>
                            <Timer className={kpiIconClassName} />
                            <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-3 pt-3 sm:gap-4 sm:pt-4">
                                <div className="min-w-0 text-center">
                                    <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900 sm:text-[32px]">
                                        {monthHours.toFixed(1)}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:mt-1.5 sm:text-[11px]">
                                        Hours
                                    </p>
                                </div>
                                <div className="h-8 w-px shrink-0 bg-slate-100 sm:h-9" />
                                <div className="min-w-0 text-center">
                                    <p className="text-[28px] font-bold leading-none tracking-tight text-blue-600 sm:text-[32px]">
                                        {completedTasksCount}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:mt-1.5 sm:text-[11px]">
                                        Tasks
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-6 pt-2 sm:space-y-8 sm:pt-3 lg:space-y-10 lg:pt-4">
                <HomeTaskColumns
                    urgentTasks={serialize(urgentTasksRaw)}
                    overdueTasks={serialize(overdueTasksRaw)}
                    normalTasks={serialize(normalTasksRaw)}
                    allServices={serialize(allServicesRaw)}
                    hourlyRate={hourlyRate}
                />
            </section>

            <HomeRevenueDistributionChart
                sourceProjects={revenueSourceProjects}
                allServices={serialize(allServicesRaw)}
                hourlyRate={hourlyRate}
            />
        </div>
    )
}
