import { QuickStart } from "@/components/dashboard/quick-start"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { StatsCard } from "@/components/dashboard/stats-card"
import { RecurringProjectsList } from "@/components/dashboard/recurring-projects-list"
import { OneTimeProjectsList } from "@/components/dashboard/one-time-projects-list"
import prisma from "@/lib/prisma"
import { CreditCard, Clock } from "lucide-react"
import { GreetingHeader } from "@/components/dashboard/greeting-header"

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

  // Split into Recurring and One-Time
  const recurringProjects: any[] = []
  const oneTimeProjects: any[] = []

  activeProjects.forEach((project: any) => {
    const isRecurring = project.services.some((s: any) => s.isRecurring)
    const formattedProject = {
      id: project.id,
      siteName: project.site.domainName,
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


  // Data for QuickActions
  const partners = await prisma.partner.findMany({
    include: { sites: { select: { id: true, domainName: true } } },
    orderBy: { name: "asc" }
  })
  const services = await prisma.service.findMany({ orderBy: { serviceName: "asc" } })
  const quickActionProjects = activeProjects.map((p: any) => ({
    id: p.id,
    siteName: p.site.domainName,
    services: p.services
  }))

  const formattedPartners = JSON.parse(JSON.stringify(partners))
  const formattedServices = JSON.parse(JSON.stringify(services))


  // Recent Projects for QuickStart (Keeping this feature at bottom)
  const recentProjects = await prisma.project.findMany({
    take: 4,
    orderBy: { updatedAt: "desc" },
    include: {
      services: true,
      site: { include: { partner: true } },
    },
  })

  const finalRecentProjects = recentProjects.map((p: any) => ({
    id: p.id,
    name: p.name || (p.services?.[0]?.serviceName || "Unnamed Project"),
    partnerName: p.site.partner.name,
    siteName: p.site.domainName,
  }))

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
            value={formattedRevenue}
            description="Across all active engagements"
            icon={CreditCard}
            trend="+12% vs last month"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <StatsCard
            title="Operational Velocity"
            value={`${totalHoursMonth}h`}
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
            projects={quickActionProjects}
          />
        </div>

        {/* Project Lists - Parallel Columns */}
        <div className="md:col-span-4 lg:col-span-4">
          <RecurringProjectsList projects={recurringProjects} />
        </div>
        <div className="md:col-span-4 lg:col-span-2">
          <OneTimeProjectsList projects={oneTimeProjects} />
        </div>

        {/* Recent Context */}
        <div className="md:col-span-4 lg:col-span-6 pt-6 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Asset Context</h3>
          </div>
          <QuickStart recentProjects={finalRecentProjects} />
        </div>
      </div>
    </div>
  )
}
