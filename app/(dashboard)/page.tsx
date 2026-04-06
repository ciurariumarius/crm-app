import Link from "next/link"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { FolderPlus, BadgeCheck, Timer, Banknote } from "lucide-react"
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
    const urgentTasksCount = urgentTasksRaw.length
    const overdueTasksCount = overdueTasksRaw.length
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

    return (
        <div className="flex flex-col gap-10 pb-10">
            <section className="space-y-6">
                <div className="flex items-start justify-between gap-4 md:hidden">
                    <div className="flex items-start gap-3">
                        <MobileMenuTrigger />
                        <h1 className="ui-text-title text-slate-900">Overview</h1>
                    </div>
                    <GlobalSearch />
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

                <div className="flex flex-col lg:flex-row overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                    {/* Revenue Card */}
                    <div className="flex-1 relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Revenue</p>
                            <Banknote className="h-8 w-8 text-slate-100 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end justify-between">
                            <div>
                                <Link
                                    href={unpaidProjectsHref}
                                    className="group inline-flex flex-col rounded-md transition-colors hover:bg-rose-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                                    aria-label="View unpaid projects"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Unpaid</p>
                                    <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-rose-600 group-hover:underline">
                                        {formatCurrency(unpaidRevenue)}
                                    </p>
                                </Link>
                            </div>
                            <div className="text-right">
                                <Link
                                    href={thisMonthProjectsHref}
                                    className="group inline-flex flex-col items-end rounded-md transition-colors hover:bg-[color:color-mix(in_srgb,var(--primary-container)_14%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--primary-container)_35%,transparent)]"
                                    aria-label="View this month projects"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--primary)]">This month</p>
                                    <div className="mt-1 flex items-center justify-end gap-2">
                                        <p className="text-sm font-bold text-slate-800 group-hover:underline">{formatCurrency(monthRevenue)}</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Active Projects Card */}
                    <div className="flex-1 relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
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
                    <div className="flex-1 relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
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
                    <div className="flex-1 relative p-6 lg:p-8">
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

            <section className="space-y-10 pt-4">
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
