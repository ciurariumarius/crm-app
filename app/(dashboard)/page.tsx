import { RecurringProjectsList } from "@/components/dashboard/recurring-projects-list"
import { OneTimeProjectsList } from "@/components/dashboard/one-time-projects-list"
import { serialize } from "@/lib/utils"
import prisma from "@/lib/prisma"
import { Target, FolderDot, Wallet } from "lucide-react"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { calculateDashboardMetrics } from "@/lib/dashboard-utils"
import { ProjectSheetWrapper } from "@/components/projects/project-sheet-wrapper"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { DashboardHeaderActions } from "@/components/dashboard/dashboard-header-actions"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { BusinessHealthPulse } from "@/components/dashboard/business-health-pulse"
import { FocusMatrix } from "@/components/dashboard/focus-matrix"
import { SettleUpLedger } from "@/components/dashboard/settle-up-ledger"
import { ProfitabilityAlerts } from "@/components/dashboard/profitability-alerts"
import { SettlementHistory } from "@/components/dashboard/settlement-history"
import { GlobalSearch } from "@/components/dashboard/global-search"
import { MobileHomeView } from "@/components/dashboard/mobile-home-view"
import type { MobileHomeViewProps } from "@/components/dashboard/mobile-home-view"
import { normalizeProjectStatus, normalizeTaskStatus } from "@/lib/status"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await requireTenantContext()
  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId },
    select: {
      name: true,
      username: true,
      profilePic: true,
      hourlyRate: true,
    }
  })

  let activeProjects: unknown[] = []
  let timeLogsThisMonth: { _sum: { durationSeconds: number | null } } = { _sum: { durationSeconds: null } }
  let recentProjects: unknown[] = []
  let upcomingTasks: unknown[] = []
  let partners: unknown[] = []
  let services: unknown[] = []
  let settlementAuditLogs: unknown[] = []
  let dashboardQueryFailed = false

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  try {

    // Run all independent queries in parallel
    ;[activeProjects, timeLogsThisMonth, recentProjects, upcomingTasks, partners, services, settlementAuditLogs] = await Promise.all([
      // Active + unpaid projects + all projects created this month
      prisma.project.findMany({
        where: {
          tenantId: session.tenantId,
          OR: [
            { status: "Active" },
            { paymentStatus: "Unpaid" },
            { createdAt: { gte: startOfMonth } }
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
          timeLogs: true,
          tasks: { include: { timeLogs: true } },
          _count: { select: { tasks: true } }
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
      // Recently Paid Projects (Log)
      prisma.project.findMany({
        where: {
          tenantId: session.tenantId,
          paymentStatus: "Paid",
          paidAt: { not: null }
        },
        orderBy: { paidAt: "desc" },
        take: 10,
        include: {
          services: true,
          site: { include: { partner: true } }
        }
      })
    ])
  } catch (error) {
    dashboardQueryFailed = true
    console.error("[dashboard] failed to load homepage data", error)
  }

  const hourlyRate = Number((user as { hourlyRate?: number | string | null } | null)?.hourlyRate || 0)
  const normalizedActiveProjects = (activeProjects as any[]).map((project: any) => ({
    ...project,
    status: normalizeProjectStatus(project.status),
  }))
  const normalizedUpcomingTasks = (upcomingTasks as any[]).map((task: any) => ({
    ...task,
    status: normalizeTaskStatus(task.status),
  }))
  const metrics = calculateDashboardMetrics(
    normalizedActiveProjects,
    timeLogsThisMonth,
    recentProjects,
    normalizedUpcomingTasks.length,
    hourlyRate,
    settlementAuditLogs,
    startOfMonth
  )
  const formattedPartners = serialize(partners) as MobileHomeViewProps["partners"]
  const formattedServices = serialize(services) as MobileHomeViewProps["services"]
  const serializedActiveProjects = serialize(normalizedActiveProjects)
  const serializedUpcomingTasks = serialize(normalizedUpcomingTasks) as MobileHomeViewProps["upcomingTasks"]
  const serializedRecurringProjects = serialize(metrics.recurringProjects)
  const serializedOneTimeProjects = serialize(metrics.oneTimeProjects)
  const serializedUnpaidPartners = serialize(metrics.unpaidByPartner)
  const serializedSettlementHistory = serialize(metrics.settlementHistory)
  const serializedQuickActionProjects = serialize(metrics.quickActionProjects)

  return (
    <ProjectSheetWrapper
      projects={serializedActiveProjects}
      allServices={formattedServices}
      hourlyRate={user?.hourlyRate ? Number(user.hourlyRate) : 0}
    >
      <TaskSheetWrapper tasks={serializedUpcomingTasks}>
        <div id="dashboard-main-container" className="flex flex-col gap-6 pb-10">
          <MobileHomeView
            user={serialize(user)}
            formattedRevenue={metrics.formattedRevenue}
            unpaidBalance={metrics.allTimeUnpaidRevenue}
            activeTasks={metrics.totalActiveTasks}
            totalHoursMonth={metrics.totalHoursMonth}
            activeMonthlyProjects={metrics.activeMonthlyProjectsCount}
            activeOneTimeProjects={metrics.activeOneTimeProjectsCount}
            upcomingTasks={serializedUpcomingTasks}
            recurringProjects={serializedRecurringProjects}
            oneTimeProjects={serializedOneTimeProjects}
            unpaidByPartner={serializedUnpaidPartners}
            settlementHistory={serializedSettlementHistory}
            partners={formattedPartners}
            services={formattedServices}
            quickActionProjects={serializedQuickActionProjects}
            dashboardQueryFailed={dashboardQueryFailed}
          />

          <div className="hidden md:block space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex h-10 items-center md:pl-0 gap-4 shrink-0">
                <MobileMenuTrigger />
                <GreetingHeader name={user?.name?.split(" ")[0] || user?.username || "Admin"} />
              </div>
              <div className="flex-1 flex justify-center px-4">
                <GlobalSearch />
              </div>
              <div className="flex items-center gap-3 md:pl-0 w-full md:w-auto shrink-0">
                <DashboardHeaderActions
                  partners={formattedPartners}
                  services={formattedServices}
                  activeProjects={serializedQuickActionProjects}
                />
              </div>
            </div>

            <BusinessHealthPulse
              id="v5-financial-pulse"
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

            {/* Main Content Flow: All Full-Width and Vertical */}
            <div className="flex flex-col gap-0">
              {/* ── SECTION 1: Your Tasks ──────────────────────────────────── */}
              <div className="relative rounded-3xl border border-emerald-100 bg-emerald-50/30 p-8 mb-8">
                <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-emerald-400" />
                <div className="flex items-center gap-3 mb-6 pl-4">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-emerald-700">Your Tasks</h2>
                    <p className="text-[11px] text-emerald-600/70 font-medium">Active work items across all projects</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <ProfitabilityAlerts alerts={serialize(metrics.timeSinkAlerts)} />
                  <FocusMatrix tasks={serializedUpcomingTasks} />
                </div>
              </div>

              {/* ── SECTION 2: Projects ────────────────────────────────────── */}
              <div className="relative rounded-3xl border border-blue-100 bg-blue-50/20 p-8 mb-8">
                <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-blue-400" />
                <div className="flex items-center gap-3 mb-6 pl-4">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <FolderDot className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-blue-700">Projects</h2>
                    <p className="text-[11px] text-blue-600/70 font-medium">Monthly subscriptions &amp; fixed-fee work</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-600/80">Monthly Subscriptions</span>
                    </div>
                    <RecurringProjectsList
                      projects={serializedRecurringProjects}
                      partners={formattedPartners}
                      services={formattedServices}
                    />
                  </div>
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-indigo-600/80">Fixed-Fee Projects</span>
                    </div>
                    <OneTimeProjectsList
                      projects={serializedOneTimeProjects}
                      partners={formattedPartners}
                      services={formattedServices}
                    />
                  </div>
                </div>
              </div>

              {/* ── SECTION 3: Payments ────────────────────────────────────── */}
              <div className="relative rounded-3xl border border-amber-100 bg-amber-50/20 p-8">
                <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-amber-400" />
                <div className="flex items-center gap-3 mb-6 pl-4">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-amber-700">Payments</h2>
                    <p className="text-[11px] text-amber-600/70 font-medium">Due balances &amp; settlement history</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <SettleUpLedger id="v5-settle-ledger" partners={serializedUnpaidPartners} />
                  <SettlementHistory history={serializedSettlementHistory} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </TaskSheetWrapper>
    </ProjectSheetWrapper>
  )
}
