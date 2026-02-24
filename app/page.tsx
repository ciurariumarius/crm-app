import { QuickStart } from "@/components/dashboard/quick-start"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecurringProjectsList } from "@/components/dashboard/recurring-projects-list"
import { OneTimeProjectsList } from "@/components/dashboard/one-time-projects-list"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { serialize } from "@/lib/utils"
import { FinancialStatusBar } from "@/components/dashboard/financial-status-bar"
import prisma from "@/lib/prisma"
import { CreditCard, Clock } from "lucide-react"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { calculateDashboardMetrics } from "@/lib/dashboard-utils"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { getSession } from "@/lib/auth"
import { DashboardHeaderActions } from "@/components/dashboard/dashboard-header-actions"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await getSession()
  let user: any = null
  if (session) {
    user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, username: true }
    })
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // Run all independent queries in parallel
  const [activeProjects, timeLogsThisMonth, recentProjects, upcomingTasks, partners, services] = await Promise.all([
    // Active + unpaid projects
    prisma.project.findMany({
      where: {
        OR: [
          { status: "Active" },
          { paymentStatus: "Unpaid" }
        ]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        services: true,
        site: { include: { partner: true } },
        timeLogs: { where: { startTime: { gte: startOfMonth } } },
        _count: { select: { tasks: { where: { status: "Completed" } } } },
        tasks: true
      },
    }),
    // Monthly time aggregate
    prisma.timeLog.aggregate({
      _sum: { durationSeconds: true },
      where: { startTime: { gte: startOfMonth } }
    }),
    // Recent projects
    prisma.project.findMany({
      take: 4,
      orderBy: { updatedAt: "desc" },
      include: {
        services: true,
        site: { include: { partner: true } },
      },
    }),
    // Upcoming tasks
    prisma.task.findMany({
      where: {
        status: { not: 'Completed' },
        OR: [
          { urgency: 'Urgent' },
          { deadline: { lte: new Date(new Date().setHours(23, 59, 59, 999)) } }
        ]
      },
      orderBy: [
        { urgency: 'desc' },
        { deadline: 'asc' }
      ],
      take: 20,
      include: {
        project: {
          include: {
            site: { include: { partner: true } },
            services: true
          }
        },
        timeLogs: { select: { durationSeconds: true } }
      }
    }),
    // Partners
    prisma.partner.findMany({
      include: { sites: { select: { id: true, domainName: true } } },
      orderBy: { name: "asc" }
    }),
    // Services
    prisma.service.findMany({ orderBy: { serviceName: "asc" } })
  ])

  const metrics = calculateDashboardMetrics(activeProjects, timeLogsThisMonth, recentProjects)
  const formattedPartners = serialize(partners)
  const formattedServices = serialize(services)

  return (
    <ProjectSheetWrapper projects={serialize(activeProjects)} allServices={formattedServices}>
      <TaskSheetWrapper tasks={serialize(upcomingTasks)}>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex h-10 items-center md:pl-0 gap-3">
              <MobileMenuTrigger />
              <GreetingHeader name={user?.name?.split(' ')[0] || user?.username || "Admin"} />
            </div>
            <div className="flex items-center gap-3 md:pl-0 w-full md:w-auto">
              <DashboardHeaderActions
                partners={formattedPartners}
                services={formattedServices}
                activeProjects={metrics.quickActionProjects}
              />
            </div>
          </div>

          {/* Metric Cards - Premium Highlight - Primary Head-Up Display */}
          <FinancialStatusBar
            totalRevenue={metrics.totalRevenue}
            formattedRevenue={metrics.formattedRevenue}
            revenueBreakdown={metrics.revenueBreakdown}
            revenueByPartner={metrics.revenueByPartner}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Area: Upcoming Tasks (Focus) */}
            <div className="lg:col-span-2">
              <UpcomingTasks
                tasks={JSON.parse(JSON.stringify(upcomingTasks))}
                projects={metrics.quickActionProjects}
              />
            </div>

            {/* Side Area: Project Lists (Context) */}
            <div className="space-y-8">
              <RecurringProjectsList
                projects={metrics.recurringProjects}
                partners={formattedPartners}
                services={formattedServices}
              />
              <OneTimeProjectsList
                projects={metrics.oneTimeProjects}
                partners={formattedPartners}
                services={formattedServices}
              />
            </div>
          </div>

        </div>
      </TaskSheetWrapper>
    </ProjectSheetWrapper>
  )
}
