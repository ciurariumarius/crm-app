import { QuickStart } from "@/components/dashboard/quick-start"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { StatsCard } from "@/components/dashboard/stats-card"
import { RecurringProjectsList } from "@/components/dashboard/recurring-projects-list"
import { OneTimeProjectsList } from "@/components/dashboard/one-time-projects-list"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import prisma from "@/lib/prisma"
import { CreditCard, Clock } from "lucide-react"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { calculateDashboardMetrics } from "@/lib/dashboard-utils"

export const dynamic = "force-dynamic"

export default async function Home() {
  // Fetch active projects
  const activeProjects = await prisma.project.findMany({
    where: {
      status: "Active"
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
      tasks: {
        select: { id: true }
      }
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

  // Upcoming Tasks
  const upcomingTasks = await prisma.task.findMany({
    where: {
      status: { not: 'Completed' },
      OR: [
        { deadline: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, // Next 7 days
        { urgency: { in: ['High', 'Urgent'] } }
      ]
    },
    orderBy: [
      { urgency: 'desc' }, // Urgent first
      { deadline: 'asc' }  // Soonest first
    ],
    take: 20,
    include: {
      project: {
        include: { site: { include: { partner: true } } }
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
    <div className="space-y-10 pb-10">
      <div className="flex flex-col gap-2">
        <GreetingHeader name="Marius" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {/* Metric Cards - Premium Highlight */}
        <div className="md:col-span-2 lg:col-span-3">
          <StatsCard
            title="Projected Billing"
            value={metrics.formattedRevenue}
            description="Across all active engagements"
            icon={CreditCard}
            trend="+12% vs last month"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <StatsCard
            title="Operational Velocity"
            value={`${metrics.totalHoursMonth}h`}
            description="Total logged this billing cycle"
            icon={Clock}
            trend="Stable output"
          />
        </div>

        {/* Quick Actions - Full Width Row */}
        <div className="md:col-span-4 lg:col-span-6">
          <QuickActions
            partners={formattedPartners}
            services={formattedServices}
            projects={metrics.quickActionProjects}
          />
        </div>

        {/* Project Lists - Parallel Columns */}
        <div className="md:col-span-4 lg:col-span-4">
          <RecurringProjectsList projects={metrics.recurringProjects} />
        </div>
        <div className="md:col-span-4 lg:col-span-2">
          <OneTimeProjectsList projects={metrics.oneTimeProjects} />
        </div>

        {/* Upcoming Tasks - Parallel Columns */}
        <div className="md:col-span-4 lg:col-span-6 h-[400px]">
          <UpcomingTasks tasks={JSON.parse(JSON.stringify(upcomingTasks))} />
        </div>

        {/* Recent Context */}
        <div className="md:col-span-4 lg:col-span-6 pt-6 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Asset Context</h3>
          </div>
          <QuickStart recentProjects={metrics.finalRecentProjects} />
        </div>
      </div>
    </div>
  )
}
