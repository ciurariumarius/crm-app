import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, TrendingUp, CheckSquare, Zap, Target } from "lucide-react"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import Link from "next/link"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function TasksPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string; projectId?: string }>
}) {
    const params = await searchParams
    const q = params.q
    const statusFilter = params.status || "Active"
    const partnerId = params.partnerId
    const projectId = params.projectId

    // Fetch all tasks with project and partner info for metrics and filtering
    const allTasksPromise = prisma.task.findMany({
        include: {
            project: {
                include: {
                    services: true,
                    site: {
                        include: {
                            partner: true
                        }
                    }
                }
            }
        },
        orderBy: {
            updatedAt: "desc"
        }
    })

    const servicesPromise = prisma.service.findMany({
        orderBy: { serviceName: "asc" }
    })

    const [allTasks, allServicesRaw] = await Promise.all([allTasksPromise, servicesPromise])
    const allServices = JSON.parse(JSON.stringify(allServicesRaw))

    // Calculate metrics based on ALL tasks
    const activeTasksCount = allTasks.filter((t: any) => t.status === "Active").length
    const pausedTasksCount = allTasks.filter((t: any) => t.status === "Paused").length
    const completedTasksCount = allTasks.filter((t: any) => t.status === "Completed").length

    // Apply filters to tasks for the display
    let filteredTasks = allTasks.filter((task: any) => {
        // Status filter (from Cards or Select)
        if (statusFilter && statusFilter !== "All") {
            if (task.status !== statusFilter) return false
        }

        // Partner filter
        if (partnerId && task.project.site.partner.id !== partnerId) return false

        // Project filter
        if (projectId && task.project.id !== projectId) return false

        // Search query filter
        if (q) {
            const searchLower = q.toLowerCase()
            const matchesName = task.name.toLowerCase().includes(searchLower)
            const matchesProject = (task.project.name || task.project.site.domainName).toLowerCase().includes(searchLower)
            const matchesPartner = task.project.site.partner.name.toLowerCase().includes(searchLower)

            if (!matchesName && !matchesProject && !matchesPartner) return false
        }

        return true
    })

    // Serialize to plain object
    const serializedTasks = JSON.parse(JSON.stringify(filteredTasks))

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">
                    Tasks
                </h1>
            </div>

            {/* Status Filters */}
            <div className="grid gap-3 md:grid-cols-3">
                <Link href="/tasks?status=Active" className={cn("group block transition-all hover:translate-y-[-2px]", statusFilter === 'Active' ? 'ring-1 ring-primary/40' : '')}>
                    <Card className="bg-card border-border hover:border-primary/20 transition-all duration-300 py-3 gap-1 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Active Tasks</CardTitle>
                            <div className="p-1.5 rounded-lg bg-primary/10">
                                <Zap className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground">{activeTasksCount}</div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/tasks?status=Paused" className={cn("group block transition-all hover:translate-y-[-2px]", statusFilter === 'Paused' ? 'ring-1 ring-primary/40' : '')}>
                    <Card className="bg-card border-border hover:border-orange-500/20 transition-all duration-300 py-3 gap-1 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Paused Tasks</CardTitle>
                            <div className="p-1.5 rounded-lg bg-orange-500/10">
                                <AlertCircle className="h-3.5 w-3.5 text-orange-500" strokeWidth={1.5} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground">{pausedTasksCount}</div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/tasks?status=Completed" className={cn("group block transition-all hover:translate-y-[-2px]", statusFilter === 'Completed' ? 'ring-1 ring-primary/40' : '')}>
                    <Card className="bg-card border-border hover:border-emerald-500/20 transition-all duration-300 py-3 gap-1 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Completed Tasks</CardTitle>
                            <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                <CheckSquare className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4">
                            <div className="text-2xl font-bold tracking-[-0.03em] text-foreground">{completedTasksCount}</div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Extract unique partners and projects for filters */}
            {(() => {
                const partnersList = Array.from(new Set(allTasks.map((t: any) => JSON.stringify({ id: t.project.site.partner.id, name: t.project.site.partner.name })))).map((s) => JSON.parse(s as string))
                const projectsList = Array.from(new Set(allTasks.map((t: any) => JSON.stringify({ id: t.project.id, name: t.project.name || t.project.site.domainName })))).map((s) => JSON.parse(s as string))

                return (
                    <div className="space-y-4">
                        <TasksToolbar partners={partnersList} projects={projectsList} />
                        <TasksCardView tasks={serializedTasks} allServices={allServices} />
                    </div>
                )
            })()}
        </div>
    )
}
