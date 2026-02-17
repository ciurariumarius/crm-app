import { ProjectWithDetails, DashboardMetrics, FormattedProject, QuickActionProject, RecentProject } from "@/types"
import { formatProjectName } from "@/lib/utils"

export interface RevenueByPartner {
    name: string
    value: number
    fill: string
}

export function calculateDashboardMetrics(activeProjects: any[], timeLogsThisMonth: any, recentProjectsRaw: any[]): DashboardMetrics {
    // Split into Recurring and One-Time
    const recurringProjects: FormattedProject[] = []
    const oneTimeProjects: FormattedProject[] = []

    activeProjects.forEach((project: any) => {
        const isRecurring = project.services.some((s: any) => s.isRecurring)
        const formattedName = formatProjectName(project)

        const formattedProject: FormattedProject = {
            id: project.id,
            siteName: formattedName,
            hoursLogged: project.timeLogs.reduce((sum: number, log: any) => sum + (log.durationSeconds || 0), 0) / 3600,
            paymentStatus: project.paymentStatus,
            completedTasks: project._count.tasks, // Count of completed tasks
            totalTasks: project.tasks.length, // Total tasks count
            services: project.services
        }

        if (isRecurring) {
            recurringProjects.push(formattedProject)
        } else {
            oneTimeProjects.push(formattedProject)
        }
    })

    // Calculate Month Metrics
    const totalSecondsMonth = timeLogsThisMonth._sum.durationSeconds || 0
    const totalHoursMonth = (totalSecondsMonth / 3600).toFixed(1)

    // Revenue: Sum of currentFee of all active projects
    const totalRevenue = activeProjects.reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)

    // Revenue Breakdown
    let monthlyPaid = 0
    let monthlyUnpaid = 0
    let oneTimePaid = 0
    let oneTimeUnpaid = 0

    activeProjects.forEach((p: any) => {
        const isRecurring = p.services.some((s: any) => s.isRecurring)
        const fee = Number(p.currentFee) || 0
        if (p.paymentStatus === "Paid") {
            if (isRecurring) monthlyPaid += fee
            else oneTimePaid += fee
        } else {
            if (isRecurring) monthlyUnpaid += fee
            else oneTimeUnpaid += fee
        }
    })

    const currencyFormatter = new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    const formattedRevenue = currencyFormatter.format(totalRevenue)

    const revenueBreakdown = {
        monthly: {
            paid: monthlyPaid,
            unpaid: monthlyUnpaid
        },
        oneTime: {
            paid: oneTimePaid,
            unpaid: oneTimeUnpaid
        }
    }

    const quickActionProjects = activeProjects.map((p: any) => ({
        id: p.id,
        siteName: formatProjectName(p),
        services: p.services,
        status: p.status
    }))

    const finalRecentProjects = recentProjectsRaw.map((p: any) => ({
        id: p.id,
        name: formatProjectName(p),
        partnerName: p.site.partner.name,
        siteName: p.site.domainName
    }))

    // Revenue by Partner
    const revenueByPartnerMap = new Map<string, number>()
    activeProjects.forEach((p: any) => {
        const fee = Number(p.currentFee) || 0
        const partnerName = p.site?.partner?.name || "Unknown"
        revenueByPartnerMap.set(partnerName, (revenueByPartnerMap.get(partnerName) || 0) + fee)
    })

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316']

    const revenueByPartner: RevenueByPartner[] = Array.from(revenueByPartnerMap.entries())
        .map(([name, value], index) => ({
            name,
            value,
            fill: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.value - a.value)

    return {
        totalRevenue,
        formattedRevenue,
        revenueBreakdown,
        totalHoursMonth,
        recurringProjects,
        oneTimeProjects,
        quickActionProjects,
        finalRecentProjects,
        revenueByPartner
    }
}
