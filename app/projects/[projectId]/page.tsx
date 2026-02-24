import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { DeleteProjectButton } from "@/components/projects/delete-project-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getProjectDisplayName } from "@/lib/project-utils"

export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params

    const projectRaw = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            site: {
                include: {
                    partner: true
                }
            },
            services: true,
            tasks: {
                orderBy: { createdAt: "asc" }
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

    const project = JSON.parse(JSON.stringify(projectRaw))
    const allServices = JSON.parse(JSON.stringify(servicesRaw))

    return (
        <div className="space-y-6 max-w-5xl mx-auto">

            {/* Main Content Card mimicking the Sheet style */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <ProjectSheetContent
                    project={project}
                    allServices={allServices}
                />
            </div>

            {/* Danger Zone */}
            <div className="pt-8">
                <Card className="border-rose-500/20 bg-rose-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-rose-400 font-bold">Danger Zone</CardTitle>
                        <CardDescription className="text-rose-400/40 text-xs">
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
