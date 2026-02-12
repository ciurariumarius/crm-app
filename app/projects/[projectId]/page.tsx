import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { DetailedBreadcrumbs } from "@/components/layout/detailed-breadcrumbs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { Badge } from "@/components/ui/badge"
import { Globe, Users, Clock } from "lucide-react"

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

    const project = JSON.parse(JSON.stringify(projectRaw))

    return (
        <div className="space-y-8">
            <DetailedBreadcrumbs items={[
                { label: "Projects", href: "/projects" },
                { label: project.name || (project.services?.[0]?.serviceName || "Unnamed Project") }
            ]} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-bold tracking-tight">
                            {project.name || (project.services?.[0]?.serviceName || "Unnamed Project")}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground text-sm">
                        <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {project.site.domainName}
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.site.partner.name}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tasks</CardTitle>
                            <CardDescription>Manage checklist for this project.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProjectTasks projectId={project.id} initialTasks={project.tasks as any} />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Payment Status</span>
                                <Badge variant={project.paymentStatus === "Paid" ? "default" : "outline"} className={project.paymentStatus === "Paid" ? "bg-green-500 hover:bg-green-600" : ""}>
                                    {project.paymentStatus}
                                </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Fee</span>
                                <span className="font-medium">${project.currentFee?.toString() || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Logged Intervals</span>
                                <span className="flex items-center gap-1 font-medium">
                                    <Clock className="h-3 w-3" />
                                    {project._count.timeLogs} entries
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card border-dashed className="bg-muted/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-xs text-muted-foreground">Use the global timer in the bottom right to track time against this project.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
