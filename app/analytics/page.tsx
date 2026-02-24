import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, DollarSign, Clock, Briefcase, Users } from "lucide-react"
import { PartnerRevenueChart } from "@/components/vault/partner-revenue-chart"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
    // Fetch all projects with services and time logs
    const projects = await prisma.project.findMany({
        include: {
            services: true,
            site: {
                include: {
                    partner: true
                }
            },
            timeLogs: true,
            tasks: true
        }
    })

    // Calculate statistics
    const totalProjects = projects.length
    const activeProjects = projects.filter((p: any) => p.status === "Active").length
    const completedProjects = projects.filter((p: any) => p.status === "Completed").length

    const totalRevenue = projects.reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)
    const paidRevenue = projects.filter((p: any) => p.paymentStatus === "Paid").reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)
    const unpaidRevenue = projects.filter((p: any) => p.paymentStatus === "Unpaid").reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)

    const totalTimeSeconds = projects.reduce((sum: number, p: any) =>
        sum + p.timeLogs.reduce((logSum: number, log: any) => logSum + (log.durationSeconds || 0), 0), 0
    )
    const totalHours = Math.round(totalTimeSeconds / 3600)

    // Partner statistics
    const partnerStats = projects.reduce((acc: any, project: any) => {
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
        acc[partnerName].hours += project.timeLogs.reduce((sum: number, log: any) => sum + (log.durationSeconds || 0), 0) / 3600
        return acc
    }, {} as Record<string, { name: string; projects: number; revenue: number; hours: number }>)

    const topPartners = Object.values(partnerStats)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)

    // Service statistics
    const serviceStats = projects.reduce((acc: any, project: any) => {
        project.services.forEach((service: any) => {
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
    }, {} as Record<string, { name: string; count: number; revenue: number }>)

    const topServices = Object.values(serviceStats)
        .sort((a: any, b: any) => b.count - a.count)
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
            <div className="flex h-10 items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground pl-14 md:pl-0 leading-none flex items-center h-full">
                    Analytics
                </h1>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                            {activeProjects} active • {completedProjects} completed
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

            <div className="grid gap-4 md:grid-cols-2">
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
                            {topPartners.map((partner: any, index: number) => (
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
                            {topServices.map((service: any, index: number) => (
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
                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mt-1">Global revenue distribution by partner entity</p>
                    </div>
                </div>

                <div className="bg-muted/10 rounded-[2.5rem] border border-muted/50 p-8 lg:p-12 overflow-hidden shadow-sm">
                    <PartnerRevenueChart data={Object.values(partnerStats).map((p: any) => ({ name: p.name, revenue: p.revenue }))} />
                </div>
            </section>
        </div>
    )
}
