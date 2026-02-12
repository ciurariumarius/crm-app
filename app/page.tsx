import { DailyStats } from "@/components/dashboard/daily-stats"
import { QuickStart } from "@/components/dashboard/quick-start"
import { ActiveProjectsQuickLook } from "@/components/dashboard/active-projects-quick-look"
import { QuickActions } from "@/components/dashboard/quick-actions"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Home() {
  // Fetch recent projects with correct relations
  const recentProjects = await prisma.project.findMany({
    take: 4,
    orderBy: { updatedAt: "desc" },
    include: {
      services: true,
      site: {
        include: {
          partner: true,
        },
      },
    },
  })

  // Fetch active projects for quick look
  const activeProjects = await prisma.project.findMany({
    where: {
      status: "Active"
    },
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      services: true,
      site: {
        include: {
          partner: true,
        },
      },
      _count: {
        select: {
          tasks: true
        }
      }
    },
  })

  // Calculate daily stats
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const dailyLogs = await prisma.timeLog.findMany({
    where: {
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      project: {
        include: {
          site: {
            include: {
              partner: true,
            },
          },
        },
      },
    },
  })

  const totalSeconds = dailyLogs.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0)

  // Group by partner
  const partnerMap = new Map<string, number>()
  dailyLogs.forEach((log: any) => {
    const partnerName = log.project.site.partner.name
    const current = partnerMap.get(partnerName) || 0
    partnerMap.set(partnerName, current + (log.durationSeconds || 0))
  })

  const partnerStats = Array.from(partnerMap.entries()).map(([name, seconds]) => ({
    name,
    seconds,
    color: "bg-primary",
  }))

  // Format recent projects
  const finalRecentProjects = recentProjects.map((p: any) => ({
    id: p.id,
    name: p.name || (p.services?.[0]?.serviceName || "Unnamed Project"),
    partnerName: p.site.partner.name,
    siteName: p.site.domainName,
  }))

  // Format active projects
  const formattedActiveProjects = JSON.parse(JSON.stringify(activeProjects))

  // Fetch partners and services for quick actions
  const partners = await prisma.partner.findMany({
    include: {
      sites: {
        select: { id: true, domainName: true }
      }
    },
    orderBy: { name: "asc" }
  })

  const services = await prisma.service.findMany({
    orderBy: { serviceName: "asc" }
  })

  const formattedPartners = JSON.parse(JSON.stringify(partners))
  const formattedServices = JSON.parse(JSON.stringify(services))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
            <span className="text-primary">Overview</span>
          </h2>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">
            Dashboard / Quick Insights
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions partners={formattedPartners} services={formattedServices} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <DailyStats totalSeconds={totalSeconds} partnerStats={partnerStats} />
        </div>
        <div className="col-span-3">
          <ActiveProjectsQuickLook projects={formattedActiveProjects} />
        </div>
      </div>

      <QuickStart recentProjects={finalRecentProjects} />
    </div>
  )
}
