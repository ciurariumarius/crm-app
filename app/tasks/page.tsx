import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, TrendingUp, CheckSquare, Zap, Target } from "lucide-react"
import { TasksTable } from "@/components/tasks/tasks-table"
import { TasksFilters } from "@/components/tasks/tasks-filters"

export const dynamic = "force-dynamic"

export default async function TasksPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string }>
}) {
    const params = await searchParams
    const q = params.q
    const statusFilter = params.status
    const partnerId = params.partnerId

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
    const incompleteTasksCount = allTasks.filter((t: any) => !t.isCompleted).length
    const completedTasksCount = allTasks.filter((t: any) => t.isCompleted).length
    const totalTasksCount = allTasks.length
    const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0
    const activeProjectsCount = new Set(allTasks.filter((t: any) => !t.isCompleted).map((t: any) => t.project.id)).size

    // Apply filters to tasks for the table
    let filteredTasks = allTasks.filter((task: any) => {
        // Search filter
        if (q && !task.name.toLowerCase().includes(q.toLowerCase()) &&
            !task.project.site.partner.name.toLowerCase().includes(q.toLowerCase())) {
            return false
        }

        // Status filter
        if (statusFilter === "Completed" && !task.isCompleted) return false
        if (statusFilter === "Incomplete" && task.isCompleted) return false
        if (statusFilter && statusFilter !== "All" && statusFilter !== "Completed" && statusFilter !== "Incomplete") {
            if (task.status !== statusFilter) return false
        }

        // Partner filter
        if (partnerId && task.project.site.partner.id !== partnerId) return false

        return true
    })

    // Serialize to plain object to handle Prisma Decimal serialization error in Server Components
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

            {/* Productivity Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-orange-500/5 border-orange-500/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Open Tasks</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter italic">{incompleteTasksCount}</div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Across {activeProjectsCount} projects
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-500/5 border-emerald-500/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Completed</CardTitle>
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter italic">{completedTasksCount}</div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Total finished tasks
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Completion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter italic">{completionRate}%</div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Overall productivity
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-yellow-500/5 border-yellow-500/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-60">Focus Score</CardTitle>
                        <Zap className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter italic">
                            {incompleteTasksCount > 0 ? Math.min(100, Math.round(100 / incompleteTasksCount * 10)) : 100}
                        </div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            Task distribution
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks Table Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-widest italic">Operations Tasks</h3>
                    </div>
                </div>

                <TasksFilters />
                <TasksTable tasks={serializedTasks} />
            </div>
        </div>
    )
}
