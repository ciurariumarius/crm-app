import { DashboardMetrics, FormattedProject, SettlementPartner, SettlementProject, ProfitabilityAlert } from "@/types"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import type { Prisma } from "@prisma/client"

export interface RevenueByPartner {
    name: string
    value: number
    fill: string
}

type TimeLogsAggregate = {
    _sum?: {
        durationSeconds?: number | null
    } | null
}

type DashboardServiceInput = {
    serviceName?: string | null
    isRecurring: boolean
}

type DashboardProjectInput = {
    id: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string | null
    paidAt?: Date | string | null
    status: string
    paymentStatus: string
    currentFee: Prisma.Decimal | number | string | null
    services: DashboardServiceInput[]
    site: {
        domainName?: string | null
        partner?: {
            id: string
            name: string
        } | null
    } | null
    timeLogs: Array<{ durationSeconds: number | null }>
    tasks: unknown[]
    _count: {
        tasks: number
    }
}

type SettlementAuditLogProject = Pick<DashboardProjectInput, "id" | "name" | "currentFee" | "paidAt" | "updatedAt" | "site" | "services">

function toValidDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeServiceSummaries(services: DashboardServiceInput[]): FormattedProject["services"] {
    return services.map((service) => ({
        serviceName: service.serviceName?.trim() || "Unknown Service",
        isRecurring: service.isRecurring,
    }))
}

export function calculateDashboardMetrics(
    activeProjects: DashboardProjectInput[],
    timeLogsThisMonth: TimeLogsAggregate,
    recentProjectsRaw: DashboardProjectInput[],
    totalActiveTasks: number = 0,
    hourlyRate: number = 0,
    settlementAuditLogs: SettlementAuditLogProject[] = [],
    startOfMonth?: Date
): DashboardMetrics {
    const referenceDate = startOfMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    // Projects created this month (for revenue metrics)
    const currentMonthProjects = activeProjects.filter((project) => {
        const createdAt = toValidDate(project.createdAt)
        return createdAt ? createdAt >= referenceDate : false
    })

    // Split into Recurring and One-Time (Keep all active/unpaid for the main lists)
    const recurringProjects: FormattedProject[] = []
    const oneTimeProjects: FormattedProject[] = []

    activeProjects.forEach((project) => {
        const isRecurring = project.services.some((service) => service.isRecurring)
        const formattedName = formatProjectName(project)

        const formattedProject: FormattedProject = {
            id: project.id,
            siteName: formattedName,
            hoursLogged: project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0) / 3600,
            paymentStatus: project.paymentStatus,
            completedTasks: project._count.tasks,
            totalTasks: project.tasks.length,
            services: normalizeServiceSummaries(project.services),
            createdAt: project.createdAt,
            currentFee: Number(project.currentFee || 0)
        }

        if (project.status === "Active") {
            if (isRecurring) {
                recurringProjects.push(formattedProject)
            } else {
                oneTimeProjects.push(formattedProject)
            }
        }
    })

    // Calculate Month Metrics
    const totalSecondsMonth = timeLogsThisMonth?._sum?.durationSeconds || 0
    const totalHoursMonthNum = totalSecondsMonth / 3600
    const totalHoursMonth = totalHoursMonthNum.toFixed(1)
    const totalBillableHours = totalHoursMonthNum

    // Revenue: Sum of currentFee of projects created this month
    const totalRevenue = currentMonthProjects.reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)

    // Revenue Breakdown (Based on current month projects)
    let monthlyPaid = 0
    let monthlyUnpaid = 0
    let oneTimePaid = 0
    let oneTimeUnpaid = 0

    currentMonthProjects.forEach((project) => {
        const isRecurring = project.services.some((service) => service.isRecurring)
        const fee = Number(project.currentFee) || 0

        if (project.paymentStatus === "Paid") {
            if (isRecurring) monthlyPaid += fee
            else oneTimePaid += fee
        } else {
            if (isRecurring) monthlyUnpaid += fee
            else oneTimeUnpaid += fee
        }
    })

    // Unpaid Balance Tracking (Based on ALL active/unpaid projects)
    const unpaidByPartnerMap = new Map<string, { id: string, name: string, total: number, projects: SettlementProject[] }>()
    activeProjects.forEach((project) => {
        if (project.paymentStatus === "Unpaid") {
            const fee = Number(project.currentFee) || 0
            if (fee <= 0) return
            const partner = project.site?.partner
            if (partner) {
                const existing = unpaidByPartnerMap.get(partner.id) || { id: partner.id, name: partner.name, total: 0, projects: [] }
                unpaidByPartnerMap.set(partner.id, {
                    ...existing,
                    total: existing.total + fee,
                    projects: [...existing.projects, { id: project.id, name: formatProjectName(project), amount: fee }]
                })
            }
        }
    })

    const unpaidByPartner: SettlementPartner[] = Array.from(unpaidByPartnerMap.values())
        .map(p => ({
            id: p.id,
            name: p.name,
            totalUnpaid: p.total,
            lastSettlementDate: null,
            unpaidProjects: p.projects
        }))
        .filter(p => p.totalUnpaid > 0)
        .sort((a, b) => b.totalUnpaid - a.totalUnpaid)

    // Time Sink Alerts
    const timeSinkAlerts: ProfitabilityAlert[] = activeProjects
        .map((project) => {
            const fee = Number(project.currentFee) || 0
            if (fee <= 0) return null
            const projectHours = project.timeLogs.reduce((sum, log) => sum + (log.durationSeconds || 0), 0) / 3600
            const loggedValue = projectHours * hourlyRate
            const ratio = loggedValue / fee
            if (ratio > 0.8) {
                return {
                    projectId: project.id,
                    projectName: formatProjectName(project),
                    ratio,
                    fee,
                    loggedValue
                }
            }
            return null
        })
        .filter((a): a is ProfitabilityAlert => a !== null)

    // Recent Payment History (Log)
    const settlementHistory = settlementAuditLogs.map((project) => ({
        id: project.id,
        projectName: formatProjectName(project),
        partnerName: project.site?.partner?.name || "Unknown Partner",
        amount: Number(project.currentFee) || 0,
        date: project.paidAt ?? project.updatedAt ?? new Date(0)
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

    const quickActionProjects = activeProjects
        .filter((project) => project.status === "Active")
        .map((project) => ({
            id: project.id,
            siteName: formatProjectName(project),
            services: normalizeServiceSummaries(project.services),
            status: normalizeProjectStatus(project.status)
        }))

    const finalRecentProjects = recentProjectsRaw.map((project) => ({
        id: project.id,
        name: formatProjectName(project),
        partnerName: project.site?.partner?.name || "Unknown Partner",
        siteName: project.site?.domainName || "Unknown Site"
    }))

    // Revenue by Partner Chart Data (Based on current month projects)
    const revenueByPartnerMap = new Map<string, number>()
    currentMonthProjects.forEach((project) => {
        const fee = Number(project.currentFee) || 0
        const partnerName = project.site?.partner?.name || "Unknown"
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
    const isRecurringService = (service: DashboardServiceInput) => service.isRecurring
    const activeMonthlyProjectsCount = activeProjects.filter(
        (project) => project.status === "Active" && project.services.some(isRecurringService)
    ).length
    const activeOneTimeProjectsCount = activeProjects.filter(
        (project) => project.status === "Active" && !project.services.some(isRecurringService)
    ).length

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
