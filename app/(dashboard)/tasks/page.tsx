import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { formatProjectName } from "@/lib/utils"
import { TasksViewToggle } from "@/components/tasks/tasks-view-toggle"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 30

function buildSort(sort: string): Prisma.TaskOrderByWithRelationInput[] {
    switch (sort) {
        case "oldest":
            return [{ createdAt: "asc" }]
        case "updated":
            return [{ updatedAt: "desc" }]
        case "name_asc":
            return [{ name: "asc" }]
        case "name_desc":
            return [{ name: "desc" }]
        case "newest":
        default:
            return [{ createdAt: "desc" }]
    }
}

export default async function TasksPage({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string
        status?: string
        partnerId?: string
        projectId?: string
        urgency?: string
        sort?: string
        view?: string
        cols?: string
        page?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const q = params.q?.trim()
    const statusFilter = params.status || "Active"
    const partnerId = params.partnerId
    const projectId = params.projectId
    const urgencyFilter = params.urgency || "all"
    const sort = params.sort || "newest"
    const view = (params.view as "grid" | "list") || "grid"
    const cols = Number(params.cols) || 3
    const page = Math.max(1, Number(params.page) || 1)

    const where: Prisma.TaskWhereInput = { tenantId: session.tenantId }

    if (statusFilter !== "All") {
        where.status = statusFilter
    }

    if (projectId && projectId !== "all") {
        where.projectId = projectId
    } else if (partnerId && partnerId !== "all") {
        where.project = { site: { partnerId } }
    }

    if (urgencyFilter !== "all") {
        where.urgency = urgencyFilter
    }

    if (q) {
        where.OR = [
            { name: { contains: q } },
            { description: { contains: q } },
            { project: { name: { contains: q } } },
            { project: { site: { domainName: { contains: q } } } },
            { project: { site: { partner: { name: { contains: q } } } } },
        ]
    }

    const [tasksRaw, totalTasks, allServicesRaw, activeTimerRaw, allProjectsRaw] = await Promise.all([
        prisma.task.findMany({
            where,
            include: {
                project: {
                    include: {
                        services: true,
                        site: {
                            include: {
                                partner: true,
                            },
                        },
                    },
                },
                timeLogs: true,
            },
            orderBy: buildSort(sort),
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.task.count({ where }),
        prisma.service.findMany({ where: { tenantId: session.tenantId }, orderBy: { serviceName: "asc" } }),
        prisma.timeLog.findFirst({
            where: { endTime: null, tenantId: session.tenantId },
            include: { task: true, project: true },
        }),
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            select: {
                id: true,
                name: true,
                status: true,
                site: {
                    select: {
                        domainName: true,
                        partner: { select: { id: true, name: true } },
                    },
                },
                services: { select: { serviceName: true, isRecurring: true } },
                createdAt: true,
            },
            orderBy: { updatedAt: "desc" },
        }),
    ])

    const allServices = JSON.parse(JSON.stringify(allServicesRaw))
    const initialActiveTimer = JSON.parse(JSON.stringify(activeTimerRaw))
    const activeProjects = JSON.parse(JSON.stringify(allProjectsRaw))

    const activeTasksCount = await prisma.task.count({ where: { tenantId: session.tenantId, status: "Active" } })

    const serializedTasks = JSON.parse(JSON.stringify(tasksRaw))
    const projectsList = allProjectsRaw
        .map((project) => ({ id: project.id, name: formatProjectName(project) }))
        .sort((a, b) => a.name.localeCompare(b.name))

    const partnersMap = new Map()
    allProjectsRaw.forEach((p: any) => {
        if (p.site?.partner) {
            partnersMap.set(p.site.partner.id, { id: p.site.partner.id, name: p.site.partner.name })
        }
    })
    const partnersList = Array.from(partnersMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (statusFilter) next.set("status", statusFilter)
        if (partnerId) next.set("partnerId", partnerId)
        if (projectId) next.set("projectId", projectId)
        if (urgencyFilter) next.set("urgency", urgencyFilter)
        if (sort) next.set("sort", sort)
        if (view) next.set("view", view)
        if (cols) next.set("cols", String(cols))
        next.set("page", String(targetPage))
        return `/tasks?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header Row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[180px] shrink-0">
                    <MobileMenuTrigger />
                    <h1 className="page-title">
                        Tasks
                    </h1>
                </div>

                <div className="w-full md:flex-1 md:max-w-2xl px-0 md:px-4 shrink-0 transition-all">
                    <TasksSearchInput />
                </div>

                <div className="flex items-center justify-end gap-3 w-full md:w-auto md:min-w-[180px] shrink-0">
                    <TasksViewToggle currentView={view} />
                    <CreateTaskButton projects={activeProjects} />
                </div>
            </div>

            <div className="space-y-4">
                <TasksToolbar
                    projects={projectsList}
                    partners={partnersList}
                    totalTasks={totalTasks}
                />
                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                    view={view}
                    cols={cols}
                />

                <div className="flex justify-center w-full py-4">
                    <CreateTaskButton projects={activeProjects} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm mt-4">
                    <span className="text-muted-foreground">Page {page} of {totalPages} · {totalTasks} tasks</span>
                    <div className="flex items-center gap-2">
                        {prevPage ? (
                            <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(prevPage)}>
                                Previous
                            </Link>
                        ) : (
                            <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Previous</span>
                        )}
                        {nextPage ? (
                            <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(nextPage)}>
                                Next
                            </Link>
                        ) : (
                            <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Next</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
