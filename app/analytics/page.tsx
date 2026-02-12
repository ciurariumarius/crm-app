import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, DollarSign, Clock, Briefcase, Users } from "lucide-react"

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
    const activeProjects = projects.filter(p => p.status === "Active").length
    const completedProjects = projects.filter(p => p.status === "Completed").length

    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.fee) || 0), 0)
    const paidRevenue = projects.filter(p => p.paymentStatus === "Paid").reduce((sum, p) => sum + (Number(p.fee) || 0), 0)
    const unpaidRevenue = projects.filter(p => p.paymentStatus === "Unpaid").reduce((sum, p) => sum + (Number(p.fee) || 0), 0)

    const totalTimeSeconds = projects.reduce((sum, p) =>
        sum + p.timeLogs.reduce((logSum, log) => logSum + (log.durationSeconds || 0), 0), 0
    )
    const totalHours = Math.round(totalTimeSeconds / 3600)

    // Partner statistics
    const partnerStats = projects.reduce((acc, project) => {
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
        acc[partnerName].revenue += Number(project.fee) || 0
        acc[partnerName].hours += project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0) / 3600
        return acc
    }, {} as Record<string, { name: string; projects: number; revenue: number; hours: number }>)

    const topPartners = Object.values(partnerStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

    // Service statistics
    const serviceStats = projects.reduce((acc, project) => {
        project.services.forEach(service => {
            if (!acc[service.serviceName]) {
                acc[service.serviceName] = {
                    name: service.serviceName,
                    count: 0,
                    revenue: 0
                }
            }
            acc[service.serviceName].count++
            acc[service.serviceName].revenue += Number(project.fee) || 0
        })
        return acc
    }, {} as Record<string, { name: string; count: number; revenue: number }>)

    const topServices = Object.values(serviceStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
                    <span className="text-primary">Analytics</span>
                </h2>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">
                    Data Insights / Performance Metrics
                </p>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalRevenue.toLocaleString()} RON</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-600 font-bold">{paidRevenue.toLocaleString()}</span> paid •
                            <span className="text-rose-600 font-bold ml-1">{unpaidRevenue.toLocaleString()}</span> unpaid
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
                            {totalProjects > 0 ? Math.round(totalRevenue / totalProjects).toLocaleString() : 0} RON
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
                                        <div className="font-bold text-sm">{partner.revenue.toLocaleString()} RON</div>
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
                                        <div className="font-bold text-sm">{service.revenue.toLocaleString()} RON</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
