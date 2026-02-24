import { QuickStart } from "@/components/dashboard/quick-start"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecurringProjectsList } from "@/components/dashboard/recurring-projects-list"
import { OneTimeProjectsList } from "@/components/dashboard/one-time-projects-list"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { FinancialStatusBar } from "@/components/dashboard/financial-status-bar"
import prisma from "@/lib/prisma"
import { CreditCard, Clock } from "lucide-react"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { calculateDashboardMetrics } from "@/lib/dashboard-utils"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { getSession } from "@/lib/auth"
import { DashboardHeaderActions } from "@/components/dashboard/dashboard-header-actions"

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

  // Fetch active projects and unpaid completed projects
  const activeProjects = await prisma.project.findMany({
    where: {
      OR: [
        { status: "Active" },
        { paymentStatus: "Unpaid" }
      ]
    },
    orderBy: { updatedAt: "desc" },
    include: {
      services: true,
      site: {
        include: {
          partner: true,
        },
      },
      timeLogs: {
        where: {
          startTime: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      _count: {
        select: {
          tasks: { where: { isCompleted: true } },
        }
      },
      tasks: true
    },
  })

  // Calculate Month Metrics
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const timeLogsThisMonth = await prisma.timeLog.aggregate({
    _sum: {
      durationSeconds: true
    },
    where: {
      startTime: {
        gte: startOfMonth
      }
    }
  })

  // Recent Projects for QuickStart
  const recentProjects = await prisma.project.findMany({
    take: 4,
    orderBy: { updatedAt: "desc" },
    include: {
      services: true,
      site: { include: { partner: true } },
    },
  })

  // Today's Work: Urgent + Overdue + Today
  const upcomingTasks = await prisma.task.findMany({
    where: {
      status: { not: 'Completed' },
      OR: [
        { urgency: 'Urgent' },
        { deadline: { lte: new Date(new Date().setHours(23, 59, 59, 999)) } }
      ]
    },
    orderBy: [
      { urgency: 'desc' }, // Urgent first
      { deadline: 'asc' }  // Overdue first
    ],
    take: 20,
    include: {
      project: {
        include: {
          site: { include: { partner: true } },
          services: true
        }
      },
      timeLogs: {
        select: {
          durationSeconds: true
        }
      }
    }
  })

  // Calculate Metrics
  const metrics = calculateDashboardMetrics(activeProjects, timeLogsThisMonth, recentProjects)

  // Data for QuickActions
  const partners = await prisma.partner.findMany({
    include: { sites: { select: { id: true, domainName: true } } },
    orderBy: { name: "asc" }
  })
  const services = await prisma.service.findMany({ orderBy: { serviceName: "asc" } })

  const formattedPartners = JSON.parse(JSON.stringify(partners))
  const formattedServices = JSON.parse(JSON.stringify(services))

  return (
    <ProjectSheetWrapper projects={JSON.parse(JSON.stringify(activeProjects))} allServices={formattedServices}>
      <TaskSheetWrapper tasks={JSON.parse(JSON.stringify(upcomingTasks))}>
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex h-10 items-center justify-between gap-4">
            <div className="pl-14 md:pl-0">
              <GreetingHeader name={user?.name?.split(' ')[0] || user?.username || "Admin"} />
            </div>
            <DashboardHeaderActions
              partners={formattedPartners}
              services={formattedServices}
              activeProjects={metrics.quickActionProjects}
            />
          </div>

          {/* Metric Cards - Premium Highlight - Primary Head-Up Display */}
          <FinancialStatusBar
            totalRevenue={metrics.totalRevenue}
            formattedRevenue={metrics.formattedRevenue}
            revenueBreakdown={metrics.revenueBreakdown}
            revenueByPartner={metrics.revenueByPartner}
            mom="+12%"
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
