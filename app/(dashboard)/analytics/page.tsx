import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, DollarSign, Clock, Briefcase, Users } from "lucide-react"
import { PartnerRevenueChart } from "@/components/vault/partner-revenue-chart"
import { PageHeader } from "@/components/layout/page-header"
import { requireTenantContext } from "@/lib/tenant"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

type AnalyticsProject = Prisma.ProjectGetPayload<{
    select: {
        id: true
        status: true
        paymentStatus: true
        currentFee: true
        services: {
            select: {
                serviceName: true
                isRecurring: true
            }
        }
        site: {
            select: {
                partner: {
                    select: { name: true }
                }
            }
        }
    }
}>

type ProjectCountByStatus = {
    status: string
    _count: { _all: number }
}

type TimeByProjectEntry = {
    projectId: string
    _sum: { durationSeconds: number | null }
}

type PartnerStat = {
    name: string
    projects: number
    revenue: number
    hours: number
}

type ServiceStat = {
    name: string
    count: number
    revenue: number
}

export default async function AnalyticsPage() {
    const session = await requireTenantContext()
    // Run all queries in parallel
    const [projects, totalTimeAgg, projectCounts, timeByProject] = await Promise.all([
        // Projects with only data needed for analytics math
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                currentFee: true,
                services: {
                    select: {
                        serviceName: true,
                        isRecurring: true,
                    }
                },
                site: {
                    select: {
                        partner: {
                            select: { name: true }
                        }
                    }
                },
            },
        }),
        // Total time across all projects via aggregate
        prisma.timeLog.aggregate({
            _sum: { durationSeconds: true },
            where: { tenantId: session.tenantId },
        }),
        // Project counts by status via groupBy
        prisma.project.groupBy({
            where: { tenantId: session.tenantId },
            by: ['status'],
            _count: { _all: true }
        }),
        prisma.timeLog.groupBy({
            where: { tenantId: session.tenantId },
            by: ['projectId'],
            _sum: { durationSeconds: true },
        }),
    ])

    // Calculate statistics
    const totalProjects = projects.length
    const typedProjectCounts = projectCounts as ProjectCountByStatus[]
    const activeProjects = typedProjectCounts.find((group) => group.status === "Active")?._count._all || 0
    const pausedProjects = typedProjectCounts.find((group) => group.status === "Paused")?._count._all || 0
    const completedProjects = typedProjectCounts.find((group) => group.status === "Completed")?._count._all || 0
    const closedProjects = typedProjectCounts.find((group) => group.status === "Closed")?._count._all || 0

    const typedProjects = projects as AnalyticsProject[]
    const totalRevenue = typedProjects.reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)
    const paidRevenue = typedProjects
        .filter((project) => project.paymentStatus === "Paid")
        .reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)
    const unpaidRevenue = typedProjects
        .filter((project) => project.paymentStatus === "Unpaid")
        .reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)

    const totalTimeSeconds = totalTimeAgg._sum.durationSeconds || 0
    const totalHours = Math.round(totalTimeSeconds / 3600)
    const timeByProjectMap = new Map<string, number>(
        (timeByProject as TimeByProjectEntry[]).map((entry) => [entry.projectId, Number(entry._sum.durationSeconds) || 0])
    )

    // Partner statistics
    const partnerStats = typedProjects.reduce<Record<string, PartnerStat>>((acc, project) => {
        const partnerName = project.site.partner.name
        if (!acc[partnerName]) {
            acc[partnerName] = {
                name: partnerName,
                projects: 0,
                revenue: 0,
                hours: 0
            }
        }
        acc[partnerName].projects++
        acc[partnerName].revenue += Number(project.currentFee) || 0
        acc[partnerName].hours += (timeByProjectMap.get(project.id) || 0) / 3600
        return acc
    }, {})

    const topPartners = Object.values(partnerStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

    // Service statistics
    const serviceStats = typedProjects.reduce<Record<string, ServiceStat>>((acc, project) => {
        project.services.forEach((service) => {
            if (!acc[service.serviceName]) {
                acc[service.serviceName] = {
                    name: service.serviceName,
                    count: 0,
                    revenue: 0
                }
            }
            acc[service.serviceName].count++
            acc[service.serviceName].revenue += Number(project.currentFee) || 0
        })
        return acc
    }, {})

    const topServices = Object.values(serviceStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('ro-RO', {
            style: 'currency',
            currency: 'RON',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Analytics" />

            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-600 font-bold">{formatCurrency(paidRevenue)}</span> paid •
                            <span className="text-rose-600 font-bold ml-1">{formatCurrency(unpaidRevenue)}</span> unpaid
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProjects}</div>
                        <p className="text-xs text-muted-foreground">
                            {activeProjects} active • {pausedProjects} paused • {completedProjects} completed • {closedProjects} closed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHours}h</div>
                        <p className="text-xs text-muted-foreground">
                            Across all projects
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Project Value</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalProjects > 0 ? formatCurrency(Math.round(totalRevenue / totalProjects)) : formatCurrency(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Per project
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Partners */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Top Partners by Revenue
                        </CardTitle>
                        <CardDescription>Highest earning client relationships</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topPartners.map((partner, index) => (
                                <div key={partner.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">{partner.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {partner.projects} projects • {Math.round(partner.hours)}h
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-sm">{formatCurrency(partner.revenue)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Services */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Most Popular Services
                        </CardTitle>
                        <CardDescription>Services by project count</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topServices.map((service, index) => (
                                <div key={service.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">{service.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {service.count} projects
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-sm">{formatCurrency(service.revenue)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* PORTFOLIO COMPOSITION ANALYSIS */}
            <section className="pt-8 border-t space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">Portfolio Composition</h2>
                        <p className="ui-overline mt-1 text-muted-foreground/40">Global revenue distribution by partner entity</p>
                    </div>
                </div>

                <div className="bg-muted/10 rounded-[2.5rem] border border-muted/50 p-8 lg:p-12 overflow-hidden shadow-sm">
                    <PartnerRevenueChart data={Object.values(partnerStats).map((partner) => ({ name: partner.name, revenue: partner.revenue }))} />
                </div>
            </section>
        </div>
    )
}
