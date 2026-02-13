import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, TrendingUp, CheckSquare, Zap, Target } from "lucide-react"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksFilters } from "@/components/tasks/tasks-filters"
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
    const statusFilter = params.status
    const partnerId = params.partnerId
    const projectId = params.projectId

    // Fetch all tasks with project and partner info for metrics and filtering
    const allTasks = await prisma.task.findMany({
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

    // Calculate metrics based on ALL tasks
    const activeTasksCount = allTasks.filter((t: any) => !t.isCompleted && t.project.status === "Active").length
    const pausedTasksCount = allTasks.filter((t: any) => t.project.status === "Paused").length
    const completedTasksCount = allTasks.filter((t: any) => t.isCompleted).length

    // Apply filters to tasks for the display
    let filteredTasks = allTasks.filter((task: any) => {
        // Status filter (from Cards or Select)
        if (statusFilter === "Completed" && !task.isCompleted) return false
        if (statusFilter === "Active" && (task.isCompleted || task.project.status !== "Active")) return false
        if (statusFilter === "Paused" && task.project.status !== "Paused") return false

        if (statusFilter && statusFilter !== "All" && !["Active", "Paused", "Completed"].includes(statusFilter)) {
            if (task.status !== statusFilter) return false
        }

        // Partner filter
        if (partnerId && task.project.site.partner.id !== partnerId) return false

        // Project filter
        if (projectId && task.project.id !== projectId) return false

        return true
    })

    // Serialize to plain object
    const serializedTasks = JSON.parse(JSON.stringify(filteredTasks))

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-primary">
                        Tasks
                    </h2>
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">
                        Productivity Dashboard / Operations
                    </p>
                </div>
            </div>

            {/* Status Filters */}
            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/tasks?status=Active" className={cn("block transition-all hover:scale-[1.01] active:scale-[0.99]", statusFilter === 'Active' ? 'ring-2 ring-primary' : '')}>
                    <Card className="bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Active Tasks</CardTitle>
                            <Zap className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black tracking-tighter italic">{activeTasksCount}</div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/tasks?status=Paused" className={cn("block transition-all hover:scale-[1.01] active:scale-[0.99]", statusFilter === 'Paused' ? 'ring-2 ring-primary' : '')}>
                    <Card className="bg-orange-500/5 border-orange-500/10 hover:bg-orange-500/10 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Paused Tasks</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black tracking-tighter italic">{pausedTasksCount}</div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/tasks?status=Completed" className={cn("block transition-all hover:scale-[1.01] active:scale-[0.99]", statusFilter === 'Completed' ? 'ring-2 ring-primary' : '')}>
                    <Card className="bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Completed Tasks</CardTitle>
                            <CheckSquare className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black tracking-tighter italic">{completedTasksCount}</div>
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
                        <div className="flex items-center justify-between">
                            <TasksFilters partners={partnersList} projects={projectsList} />
                        </div>
                        <TasksCardView tasks={serializedTasks} />
                    </div>
                )
            })()}
        </div>
    )
}
