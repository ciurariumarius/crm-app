import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, TrendingUp, CheckSquare, Zap, Target } from "lucide-react"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { formatProjectName } from "@/lib/utils"
import Link from "next/link"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function TasksPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string; projectId?: string; urgency?: string; sort?: string }>
}) {
    const params = await searchParams
    const q = params.q
    const statusFilter = params.status || "Active"
    const partnerId = params.partnerId
    const projectId = params.projectId
    const urgencyFilter = params.urgency || "all"
    const sort = params.sort || "newest"

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
            },
            timeLogs: true
        },
        orderBy: {
            updatedAt: "desc"
        }
    })

    const servicesPromise = prisma.service.findMany({
        orderBy: { serviceName: "asc" }
    })

    // Fetch all projects for the "Add Task" dropdown
    const activeProjectsPromise = prisma.project.findMany({
        select: {
            id: true,
            name: true,
            status: true,
            site: { select: { domainName: true } },
            services: { select: { serviceName: true, isRecurring: true } },
            createdAt: true
        },
        orderBy: { updatedAt: "desc" }
    })

    const [allTasks, allServicesRaw, activeTimerRaw, activeProjectsRaw] = await Promise.all([
        allTasksPromise,
        servicesPromise,
        prisma.timeLog.findFirst({
            where: { endTime: null },
            include: { task: true, project: true }
        }),
        activeProjectsPromise
    ])

    const allServices = JSON.parse(JSON.stringify(allServicesRaw))
    const initialActiveTimer = JSON.parse(JSON.stringify(activeTimerRaw))
    const activeProjects = JSON.parse(JSON.stringify(activeProjectsRaw))

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
        if (partnerId && partnerId !== "all" && task.project.site.partner.id !== partnerId) return false

        // Project filter
        if (projectId && projectId !== "all" && task.project.id !== projectId) return false

        // Urgency filter
        if (urgencyFilter && urgencyFilter !== "all") {
            if (task.urgency !== urgencyFilter) return false
        }

        // Search query filter
        if (q) {
            const searchLower = q.toLowerCase()
            const matchesName = task.name.toLowerCase().includes(searchLower)
            const matchesProject = (task.project.name || task.project.site.domainName).toLowerCase().includes(searchLower)
            const matchesPartner = task.project.site.partner.name.toLowerCase().includes(searchLower)

            if (!matchesName && !matchesProject && !matchesPartner) return false
        }

        return true
    }).sort((a: any, b: any) => {
        if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        if (sort === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        if (sort === "name_asc") return a.name.localeCompare(b.name)
        if (sort === "name_desc") return b.name.localeCompare(a.name)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Serialize to plain object
    const serializedTasks = JSON.parse(JSON.stringify(filteredTasks))

    // Extract unique partners and projects for filters
    const partnersList = Array.from(new Set(allTasks.map((t: any) => JSON.stringify({ id: t.project.site.partner.id, name: t.project.site.partner.name })))).map((s) => JSON.parse(s as string)).sort((a: any, b: any) => a.name.localeCompare(b.name))
    const projectsList = Array.from(new Set(allTasks.map((t: any) => JSON.stringify({ id: t.project.id, name: formatProjectName(t.project) })))).map((s) => JSON.parse(s as string)).sort((a: any, b: any) => a.name.localeCompare(b.name))

    return (
        <div className="flex flex-col gap-6">
            <div className="flex h-10 items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground pl-14 md:pl-0 leading-none flex items-center h-full">
                    Tasks
                </h1>
                <CreateTaskButton projects={activeProjects} />
            </div>

            <div className="space-y-4">
                <TasksToolbar partners={partnersList} projects={projectsList} />
                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                />
            </div>
        </div>
    )
}
