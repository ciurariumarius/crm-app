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
import { DashboardHeaderActions } from "@/components/dashboard/dashboard-header-actions"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { BusinessHealthPulse } from "@/components/dashboard/business-health-pulse"
import { FocusMatrix } from "@/components/dashboard/focus-matrix"
import { SettleUpLedger } from "@/components/dashboard/settle-up-ledger"
import { TechnicalIntegrationBar } from "@/components/dashboard/technical-integration-bar"
import { ProfitabilityAlerts } from "@/components/dashboard/profitability-alerts"
import { SettlementHistory } from "@/components/dashboard/settlement-history"
import { Card } from "@/components/ui/card"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await requireTenantContext()
  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId },
    // @ts-ignore - hourlyRate is in the DB but the IDE's Prisma type cache is stale
    select: { name: true, username: true, hourlyRate: true }
  })

  let activeProjects: any[] = []
  let timeLogsThisMonth: { _sum: { durationSeconds: number | null } } = { _sum: { durationSeconds: null } }
  let recentProjects: any[] = []
  let upcomingTasks: any[] = []
  let partners: any[] = []
  let services: any[] = []
  let settlementAuditLogs: any[] = []
  let dashboardQueryFailed = false

  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      // Run all independent queries in parallel
      ;[activeProjects, timeLogsThisMonth, recentProjects, upcomingTasks, partners, services, settlementAuditLogs] = await Promise.all([
        // Active + unpaid projects
        prisma.project.findMany({
          where: {
            tenantId: session.tenantId,
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
          where: { startTime: { gte: startOfMonth }, tenantId: session.tenantId }
        }),
        // Recent projects
        prisma.project.findMany({
          where: { tenantId: session.tenantId },
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
            tenantId: session.tenantId,
            status: { not: 'Completed' }
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
          where: { tenantId: session.tenantId },
          include: { sites: { select: { id: true, domainName: true } } },
          orderBy: { name: "asc" }
        }),
        // Services
        prisma.service.findMany({ where: { tenantId: session.tenantId }, orderBy: { serviceName: "asc" } }),
        // Settlement Audit Logs
        prisma.auditLog.findMany({
          where: {
            tenantId: session.tenantId,
            action: "SETTLE_PARTNER"
          },
          orderBy: { createdAt: "desc" },
          take: 3
        })
      ])
  } catch (error) {
    dashboardQueryFailed = true
    console.error("[dashboard] failed to load homepage data", error)
  }

  // @ts-ignore - hourlyRate known at runtime but staleness in IDE
  const hourlyRate = Number(user?.hourlyRate || 0)
  const metrics = calculateDashboardMetrics(
    activeProjects,
    timeLogsThisMonth,
    recentProjects,
    upcomingTasks.length,
    hourlyRate,
    settlementAuditLogs
  )
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

          {/* V4 Dashboard Layout */}
          <div className="space-y-10">
            {/* Top Row: Business Health Pulse */}
            <BusinessHealthPulse
              monthlyRevenue={metrics.totalRevenue}
              formattedRevenue={metrics.formattedRevenue}
              unpaidBalance={metrics.allTimeUnpaidRevenue}
              billableHours={metrics.totalBillableHours}
              activeTasks={metrics.totalActiveTasks}
              activeMonthlyProjects={metrics.activeMonthlyProjectsCount}
              activeOneTimeProjects={metrics.activeOneTimeProjectsCount}
            />

            {dashboardQueryFailed ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                Dashboard data could not be loaded. Core navigation still works, but please run pending migrations and refresh.
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
              {/* Main Feed: Daily Engine (Focus + Alerts) */}
              <div className="lg:col-span-3 space-y-10">
                {/* Profitability Alerts Section */}
                <ProfitabilityAlerts alerts={metrics.timeSinkAlerts} />

                {/* Task Focus Matrix */}
                <FocusMatrix tasks={upcomingTasks} />
              </div>

              {/* Sidebar: Admin & Rapid Entry */}
              <div className="lg:col-span-1 space-y-8">
                {/* Settle Up Ledger */}
                <SettleUpLedger partners={metrics.unpaidByPartner} />

                {/* Technical Integration Bar */}
                <TechnicalIntegrationBar />

                {/* Existing Project Lists as secondary context */}
                <Card className="p-4 bg-muted/30 border-dashed">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Project Overview</h4>
                  <div className="space-y-6">
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
                </Card>
              </div>
            </div>

            {/* Footer: Settlement History */}
            <SettlementHistory history={metrics.settlementHistory} />
          </div>
        </div>
      </TaskSheetWrapper>
    </ProjectSheetWrapper>
  )
}
