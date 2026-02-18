import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers/providers"
import { Sidebar } from "@/components/layout/sidebar"
import { GlobalTimer } from "@/components/layout/global-timer"
import prisma from "@/lib/prisma"
import { getActiveTimer } from "@/lib/actions"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
})

export const metadata: Metadata = {
  title: "Pixelist",
  description: "Personal CRM & Time-Tracker",
  manifest: "/manifest.json", // Prepared for PWA
}

import { Toaster } from "@/components/ui/sonner"
import { TopBar } from "@/components/layout/top-bar"
import { HeaderProvider } from "@/components/layout/header-context"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const [activeTasksCountData, partnersData, servicesData, projectsRaw, activeTimerResult, pendingTasksData] = await Promise.all([
    prisma.task.count({ where: { status: { not: "Completed" } } }),
    prisma.partner.findMany({ include: { sites: { select: { id: true, domainName: true } } } }),
    prisma.service.findMany(),
    prisma.project.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        site: { select: { domainName: true } },
        services: { select: { serviceName: true, isRecurring: true } }
      }
    }),
    getActiveTimer(),
    prisma.task.findMany({
      where: { status: { not: "Completed" }, isCompleted: false },
      orderBy: [{ urgency: 'desc' }, { deadline: 'asc' }],
      take: 5,
      select: {
        id: true,
        name: true,
        urgency: true,
        deadline: true,
        project: { select: { site: { select: { domainName: true } }, name: true } }
      }
    })
  ])

  // Serialize Decimal objects
  const partners = JSON.parse(JSON.stringify(partnersData))
  const services = JSON.parse(JSON.stringify(servicesData))
  const activeTasksCount = activeTasksCountData
  const pendingTasks = JSON.parse(JSON.stringify(pendingTasksData))

  // Handle new activeTimer structure
  // Handle new activeTimer structure
  const rawActiveTimer = activeTimerResult.success && activeTimerResult.data
    ? { ...activeTimerResult.data, status: activeTimerResult.status }
    : null

  const initialActiveTimer = rawActiveTimer ? JSON.parse(JSON.stringify(rawActiveTimer)) : null

  const activeProjects = projectsRaw.map((p: any) => ({
    id: p.id,
    siteName: p.site.domainName,
    services: p.services,
    status: p.status,
    createdAt: p.createdAt
  }))

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans`}>
        <Providers initialActiveTimer={initialActiveTimer}>
          <HeaderProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0 md:ml-[70px] transition-all duration-300">
                <TopBar
                  partners={partners}
                  services={services}
                  activeTasksCount={activeTasksCount}
                  activeProjects={activeProjects}
                  initialActiveTimer={initialActiveTimer}
                  pendingTasks={pendingTasks}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 md:pt-4 transition-all duration-300">
                  {children}
                </main>
              </div>
              <GlobalTimer />
              <Toaster />
            </div>
          </HeaderProvider>
        </Providers>
      </body>
    </html>
  );
}
