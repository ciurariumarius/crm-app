import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { DeleteProjectButton } from "@/components/projects/delete-project-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { requireAuth } from "@/lib/auth"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { formatProjectName } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
    const session = await requireAuth()
    const { projectId } = await params

    const projectRaw = await prisma.project.findFirst({
        where: { id: projectId },
        include: {
            site: {
                include: {
                    partner: true
                }
            },
            services: true,
            tasks: {
                orderBy: { createdAt: "asc" },
                include: { timeLogs: true }
            },
            timeLogs: {
                orderBy: { startTime: "desc" },
                include: { task: true }
            },
            _count: {
                select: { timeLogs: true }
            }
        }
    })

    if (!projectRaw) {
        notFound()
    }

    const servicesRaw = await prisma.service.findMany({
        orderBy: { serviceName: "asc" }
    })

    const userRaw = await prisma.user.findFirst({
        where: { id: session.userId },
        select: { hourlyRate: true },
    })

    const project = JSON.parse(JSON.stringify(projectRaw))
    const allServices = JSON.parse(JSON.stringify(servicesRaw))
    const hourlyRate = Number((userRaw as { hourlyRate?: number | string | null } | null)?.hourlyRate || 0)

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <AppPageHeader title={formatProjectName(project)} subtitle="Project details, tasks, notes and delivery history." />

            {/* Main Content Card mimicking the Sheet style */}
            <div className="overflow-hidden rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                <ProjectSheetContent
                    project={project}
                    allServices={allServices}
                    hourlyRate={hourlyRate}
                    standalone
                />
            </div>

            {/* Danger Zone */}
            <div className="pt-8">
                <Card className="border-[color:color-mix(in_srgb,var(--state-urgent)_24%,var(--line-subtle))] bg-[var(--state-danger-surface)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-[var(--state-urgent)]">Danger Zone</CardTitle>
                        <CardDescription className="text-xs text-[var(--text-secondary)]">
                            Irreversible actions for this project.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DeleteProjectButton projectId={project.id} />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
