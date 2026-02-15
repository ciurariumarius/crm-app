import { Project, Service, Site, Partner, TimeLog, Task } from "@prisma/client"

// Project interface from Prisma includes paidAt, but ProjectWithDetails extends it.
export interface ProjectWithDetails extends Project {
    services: Service[]
    site: Site & {
        partner: Partner
    }
    timeLogs: TimeLog[]
    tasks: Task[]
    _count: {
        tasks: number
    }
}

export interface DashboardMetrics {
    totalRevenue: number
    formattedRevenue: string
    totalHoursMonth: string
    recurringProjects: FormattedProject[]
    oneTimeProjects: FormattedProject[]
    quickActionProjects: QuickActionProject[]
    finalRecentProjects: RecentProject[]
}

export interface FormattedProject {
    id: string
    siteName: string
    hoursLogged: number
    paymentStatus: string
    completedTasks: number
    totalTasks: number
    services: Service[]
}

export interface QuickActionProject {
    id: string
    siteName: string
    services: Service[]
    createdAt?: Date | string
}

export interface RecentProject {
    id: string
    name: string
    partnerName: string
    siteName: string
}

export type ProjectStatus = "Active" | "Paused" | "Completed"
export type PaymentStatus = "Paid" | "Unpaid"

export interface PartnerWithSites extends Partner {
    sites: { id: string; domainName: string }[]
}
