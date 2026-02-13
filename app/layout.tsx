import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as requested/standard
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalTimer } from "@/components/layout/global-timer";
import prisma from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pixelist",
  description: "Personal CRM & Time-Tracker",
  manifest: "/manifest.json", // Prepared for PWA
};

import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/layout/top-bar";
import { HeaderProvider } from "@/components/layout/header-context";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const [activeTasksCountData, partnersData, servicesData, projectsRaw] = await Promise.all([
    prisma.task.count({ where: { status: { not: "Done" } } }),
    prisma.partner.findMany({ include: { sites: { select: { id: true, domainName: true } } } }),
    prisma.service.findMany(),
    prisma.project.findMany({
      where: { status: "Active" },
      select: {
        id: true,
        site: { select: { domainName: true } },
        services: { select: { serviceName: true } }
      }
    })
  ])

  // Serialize Decimal objects
  const partners = JSON.parse(JSON.stringify(partnersData))
  const services = JSON.parse(JSON.stringify(servicesData))
  const activeTasksCount = activeTasksCountData
  const activeProjects = projectsRaw.map((p: any) => ({
    id: p.id,
    siteName: p.site.domainName,
    services: p.services
  }))

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <HeaderProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <TopBar
                  partners={partners}
                  services={services}
                  activeTasksCount={activeTasksCount}
                  activeProjects={activeProjects}
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
