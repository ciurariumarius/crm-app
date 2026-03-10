import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { HeaderProvider } from "@/components/layout/header-context"
import { ShellFrame } from "@/components/layout/shell-frame"
import { redirect } from "next/navigation"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus } from "@/lib/status"
import type { PartnerWithSites } from "@/types"
import type { Service } from "@prisma/client"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [userData, partnersData, servicesData, projectsData] = await Promise.all([
    prisma.user.findFirst({
      where: { id: session.userId, tenantId: session.tenantId },
      select: { name: true, username: true, profilePic: true },
    }),
    prisma.partner.findMany({
      where: { tenantId: session.tenantId },
      include: {
        sites: {
          select: {
            id: true,
            domainName: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { serviceName: "asc" },
    }),
    prisma.project.findMany({
      where: { tenantId: session.tenantId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        site: {
          select: {
            domainName: true,
          },
        },
        services: {
          select: {
            serviceName: true,
            isRecurring: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
  ])

  const quickActionProjectsRaw: TaskDialogProject[] = projectsData.map((project) => ({
    id: project.id,
    status: normalizeProjectStatus(project.status),
    createdAt: project.createdAt,
    site: project.site ? { domainName: project.site.domainName } : undefined,
    services: project.services,
    siteName: formatProjectName({
      site: project.site ? { domainName: project.site.domainName } : undefined,
      services: project.services,
      createdAt: project.createdAt,
    }),
  }))

  const user = userData ? JSON.parse(JSON.stringify(userData)) : undefined
  const quickActionPartners = JSON.parse(JSON.stringify(partnersData)) as PartnerWithSites[]
  const quickActionServices = JSON.parse(JSON.stringify(servicesData)) as Service[]
  const quickActionProjects = JSON.parse(JSON.stringify(quickActionProjectsRaw)) as TaskDialogProject[]

  return (
    <HeaderProvider>
      <ShellFrame
        user={user}
        quickActionPartners={quickActionPartners}
        quickActionServices={quickActionServices}
        quickActionProjects={quickActionProjects}
      >
        {children}
      </ShellFrame>
    </HeaderProvider>
  );
}
