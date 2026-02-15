import { ProjectWithDetails, DashboardMetrics, FormattedProject, QuickActionProject, RecentProject } from "@/types"
import { formatProjectName } from "@/lib/utils"

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

    // Revenue: Sum of currentFee of all active projects (Simplification as per plan)
    const totalRevenue = activeProjects.reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0)

    // Format currency
    const formattedRevenue = new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(totalRevenue)

    const quickActionProjects = activeProjects.map((p: any) => ({
        id: p.id,
        siteName: formatProjectName(p),
        services: p.services
    }))

    const finalRecentProjects = recentProjectsRaw.map((p: any) => ({
        id: p.id,
        name: formatProjectName(p),
        partnerName: p.site.partner.name,
        siteName: p.site.domainName, // Keep original domain here if needed, or update? RecentProject interface has siteName AND name.
        // RecentProject definition: name: string, siteName: string.
        // Usually name is the main display. SiteName might be secondary.
    }))

    return {
        totalRevenue,
        formattedRevenue,
        totalHoursMonth,
        recurringProjects,
        oneTimeProjects,
        quickActionProjects,
        finalRecentProjects
    }
}
