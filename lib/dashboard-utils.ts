import { ProjectWithDetails, DashboardMetrics, FormattedProject, QuickActionProject, RecentProject, SettlementPartner, ProfitabilityAlert } from "@/types"
import { formatProjectName } from "@/lib/utils"

export interface RevenueByPartner {
    name: string
    value: number
    fill: string
}

export function calculateDashboardMetrics(
    activeProjects: any[],
    timeLogsThisMonth: any,
    recentProjectsRaw: any[],
    totalActiveTasks: number = 0,
    hourlyRate: number = 0,
    settlementAuditLogs: any[] = []
): DashboardMetrics {
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
            completedTasks: project._count.tasks,
            totalTasks: project.tasks.length,
            services: project.services
        }

        if (isRecurring) {
            recurringProjects.push(formattedProject)
        } else {
            oneTimeProjects.push(formattedProject)
        }
    })

    // Calculate Month Metrics
    const totalSecondsMonth = timeLogsThisMonth?._sum?.durationSeconds || 0
    const totalHoursMonthNum = totalSecondsMonth / 3600
    const totalHoursMonth = totalHoursMonthNum.toFixed(1)
    const totalBillableHours = totalHoursMonthNum

    // Revenue: Sum of currentFee of all active projects
    const totalRevenue = activeProjects.reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)

    // Revenue Breakdown
    let monthlyPaid = 0
    let monthlyUnpaid = 0
    let oneTimePaid = 0
    let oneTimeUnpaid = 0

    const unpaidByPartnerMap = new Map<string, { id: string, name: string, total: number }>()

    activeProjects.forEach((p: any) => {
        const isRecurring = p.services.some((s: any) => s.isRecurring)
        const fee = Number(p.currentFee) || 0
        const partner = p.site?.partner

        if (p.paymentStatus === "Paid") {
            if (isRecurring) monthlyPaid += fee
            else oneTimePaid += fee
        } else {
            if (isRecurring) monthlyUnpaid += fee
            else oneTimeUnpaid += fee

            if (partner) {
                const existing = unpaidByPartnerMap.get(partner.id) || { id: partner.id, name: partner.name, total: 0 }
                unpaidByPartnerMap.set(partner.id, { ...existing, total: existing.total + fee })
            }
        }
    })

    const unpaidByPartner: SettlementPartner[] = Array.from(unpaidByPartnerMap.values())
        .map(p => ({
            id: p.id,
            name: p.name,
            totalUnpaid: p.total,
            lastSettlementDate: null // We'll need a different query for this if needed
        }))
        .sort((a, b) => b.totalUnpaid - a.totalUnpaid)

    // Time Sink Alerts
    const timeSinkAlerts: ProfitabilityAlert[] = activeProjects
        .map(p => {
            const fee = Number(p.currentFee) || 0
            if (fee <= 0) return null
            const projectHours = p.timeLogs.reduce((sum: number, log: any) => sum + (log.durationSeconds || 0), 0) / 3600
            const loggedValue = projectHours * hourlyRate
            const ratio = loggedValue / fee
            if (ratio > 0.8) {
                return {
                    projectId: p.id,
                    projectName: formatProjectName(p),
                    ratio,
                    fee,
                    loggedValue
                }
            }
            return null
        })
        .filter((a): a is ProfitabilityAlert => a !== null)

    // Recent Payment History (Log)
    const settlementHistory = settlementAuditLogs.map((p: any) => ({
        id: p.id,
        projectName: formatProjectName(p),
        partnerName: p.site?.partner?.name || "Unknown Partner",
        amount: Number(p.currentFee) || 0,
        date: p.paidAt || p.updatedAt
    }))

    const currencyFormatter = new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    const formattedRevenue = currencyFormatter.format(totalRevenue)

    const revenueBreakdown = {
        monthly: { paid: monthlyPaid, unpaid: monthlyUnpaid },
        oneTime: { paid: oneTimePaid, unpaid: oneTimeUnpaid }
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
        partnerName: p.site?.partner?.name || "Unknown Partner",
        siteName: p.site?.domainName || "Unknown Site"
    }))

    // Revenue by Partner Chart Data
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

    const allTimeUnpaidRevenue = Array.from(unpaidByPartnerMap.values()).reduce((sum, p) => sum + p.total, 0)
    const activeMonthlyProjectsCount = activeProjects.filter(p => p.status === "Active" && p.services.some((s: any) => s.isRecurring)).length
    const activeOneTimeProjectsCount = activeProjects.filter(p => p.status === "Active" && !p.services.some((s: any) => s.isRecurring)).length

    return {
        totalRevenue,
        formattedRevenue,
        revenueBreakdown,
        totalHoursMonth,
        totalBillableHours,
        recurringProjects,
        oneTimeProjects,
        quickActionProjects,
        finalRecentProjects,
        revenueByPartner,
        unpaidByPartner,
        timeSinkAlerts,
        settlementHistory,
        totalActiveTasks,
        activeMonthlyProjectsCount,
        activeOneTimeProjectsCount,
        allTimeUnpaidRevenue
    }
}
