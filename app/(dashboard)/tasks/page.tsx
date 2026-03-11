import prisma from "@/lib/prisma"
import { TasksCardView } from "@/components/tasks/tasks-card-view"
import { TasksToolbar } from "@/components/tasks/tasks-toolbar"
import { CreateTaskButton } from "@/components/tasks/create-task-button"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { formatProjectName } from "@/lib/utils"
import { normalizeProjectStatus, normalizeTaskStatus } from "@/lib/status"
import { TasksSearchInput } from "@/components/tasks/tasks-search-input"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { LayoutGrid, SlidersHorizontal, X } from "lucide-react"
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
        filters?: string
        page?: string
    }>
}) {
    const session = await requireTenantContext()
    const params = await searchParams
    const q = params.q?.trim()
    const statusFilterRaw = params.status === "Paused" ? "Active" : (params.status || "Active")
    const statusFilter = ["All", "Active", "Completed"].includes(statusFilterRaw) ? statusFilterRaw : "Active"
    const partnerId = params.partnerId
    const projectId = params.projectId
    const urgencyFilter = params.urgency || "all"
    const sort = params.sort || "newest"
    const view: "grid" = "grid"
    const cols = 3
    const mobileFiltersOpen = params.filters === "1"
    const page = Math.max(1, Number(params.page) || 1)

    const where: Prisma.TaskWhereInput = { tenantId: session.tenantId }

    if (statusFilter !== "All") {
        if (statusFilter === "Active") {
            where.status = { in: ["Active", "Paused"] }
        } else {
            where.status = statusFilter
        }
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

    const normalizedTasksRaw = tasksRaw.map((task) => ({
        ...task,
        status: normalizeTaskStatus(task.status),
    }))
    const normalizedProjectsRaw = allProjectsRaw.map((project) => ({
        ...project,
        status: normalizeProjectStatus(project.status),
    }))

    const allServices = JSON.parse(JSON.stringify(allServicesRaw))
    const initialActiveTimer = JSON.parse(JSON.stringify(activeTimerRaw))
    const activeProjects = JSON.parse(JSON.stringify(normalizedProjectsRaw))

    const serializedTasks = JSON.parse(JSON.stringify(normalizedTasksRaw))
    const projectsList = normalizedProjectsRaw
        .map((project) => ({ id: project.id, name: formatProjectName(project) }))
        .sort((a, b) => a.name.localeCompare(b.name))

    const partnersMap = new Map()
    normalizedProjectsRaw.forEach((p) => {
        if (p.site?.partner) {
            partnersMap.set(p.site.partner.id, { id: p.site.partner.id, name: p.site.partner.name })
        }
    })
    const partnersList = Array.from(partnersMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null
    const buildTasksHref = (overrides: Record<string, string | null | undefined> = {}) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (statusFilter) next.set("status", statusFilter)
        if (partnerId) next.set("partnerId", partnerId)
        if (projectId) next.set("projectId", projectId)
        if (urgencyFilter) next.set("urgency", urgencyFilter)
        if (sort) next.set("sort", sort)
        if (mobileFiltersOpen) next.set("filters", "1")
        next.set("page", String(page))

        for (const [key, value] of Object.entries(overrides)) {
            if (value === null || value === undefined || value === "") {
                next.delete(key)
            } else {
                next.set(key, value)
            }
        }

        return `/tasks?${next.toString()}`
    }
    const buildPageHref = (targetPage: number) => buildTasksHref({ page: String(targetPage) })
    const selectedProject = projectsList.find((project) => project.id === projectId)
    const selectedPartner = partnersList.find((partner) => partner.id === partnerId)
    const activeFilters: { key: string; label: string; href: string }[] = []
    if (q) activeFilters.push({ key: "q", label: `Search: ${q}`, href: buildTasksHref({ q: null, page: "1" }) })
    if (statusFilter !== "Active") activeFilters.push({ key: "status", label: `Status: ${statusFilter}`, href: buildTasksHref({ status: "Active", page: "1" }) })
    if (urgencyFilter !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${urgencyFilter}`, href: buildTasksHref({ urgency: "all", page: "1" }) })
    if (projectId && projectId !== "all") activeFilters.push({ key: "projectId", label: `Project: ${selectedProject?.name || "Selected"}`, href: buildTasksHref({ projectId: null, page: "1" }) })
    if (partnerId && partnerId !== "all") activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner?.name || "Selected"}`, href: buildTasksHref({ partnerId: null, page: "1" }) })
    const clearAllHref = buildTasksHref({
        q: null,
        status: "Active",
        urgency: "all",
        projectId: null,
        partnerId: null,
        page: "1",
    })

    return (
        <div className="flex flex-col gap-6">
            <div className="md:hidden flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-sm">
                            <LayoutGrid className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                        <h1 className="page-title text-slate-900">Tasks</h1>
                    </div>
                    <CreateTaskButton
                        projects={activeProjects}
                        label="Add Task"
                        showLabelOnMobile
                        className="!h-12 !w-auto !min-w-[148px] !rounded-2xl !px-4 !gap-2 !bg-[#EFF6FF] !text-[#2563EB] !shadow-none border border-[#BFDBFE] hover:!bg-[#DBEAFE]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <TasksSearchInput />
                    </div>
                    <Link
                        href={buildTasksHref({ filters: mobileFiltersOpen ? null : "1", page: "1" })}
                        className={mobileFiltersOpen
                            ? "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] shadow-sm"
                            : "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                    </Link>
                </div>

                <div className="inline-flex h-12 w-full items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                    {[
                        { label: "ALL", value: "All" },
                        { label: "ACTIVE", value: "Active" },
                        { label: "COMPLETED", value: "Completed" },
                    ].map((option) => (
                        <Link
                            key={option.value}
                            href={buildTasksHref({ status: option.value, page: "1" })}
                            className={
                                "inline-flex h-10 flex-1 items-center justify-center rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors " +
                                (statusFilter === option.value
                                    ? "bg-white text-[#2563EB] shadow-sm"
                                    : "text-slate-600")
                            }
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>

                <div className="inline-flex h-12 w-full items-center rounded-full border border-slate-200 bg-slate-100 p-1">
                    {[
                        { label: "ALL", value: "all" },
                        { label: "URGENT", value: "Urgent" },
                        { label: "NORMAL", value: "Normal" },
                        { label: "IDEA", value: "Idea" },
                    ].map((option) => (
                        <Link
                            key={option.value}
                            href={buildTasksHref({ urgency: option.value, page: "1" })}
                            className={
                                "inline-flex h-10 flex-1 items-center justify-center rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors " +
                                (urgencyFilter === option.value
                                    ? "bg-white text-[#2563EB] shadow-sm"
                                    : "text-slate-600")
                            }
                        >
                            {option.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 px-3 text-[11px] text-slate-500 font-semibold">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>{totalTasks} results</span>
                    </div>
                    {activeFilters.length > 0 && (
                        <Link
                            href={clearAllHref}
                            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Clear all
                        </Link>
                    )}
                </div>

                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {activeFilters.map((filter) => (
                            <Link
                                key={filter.key}
                                href={filter.href}
                                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-2.5 pr-2 text-[11px] font-medium text-slate-700 hover:bg-white"
                            >
                                <span className="max-w-[180px] truncate">{filter.label}</span>
                                <X className="h-3 w-3 text-slate-400" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Header Row (Desktop) */}
            <div className="hidden md:flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-3 min-w-[180px]">
                    <MobileMenuTrigger />
                    <h1 className="page-title">
                        Tasks
                    </h1>
                </div>

                <div className="flex-1 min-w-0">
                    <TasksSearchInput />
                </div>

                <div className="flex items-center gap-3">
                    <CreateTaskButton projects={activeProjects} />
                </div>
            </div>

            <div className="md:hidden space-y-4">
                {mobileFiltersOpen ? (
                    <TasksToolbar
                        projects={projectsList}
                        partners={partnersList}
                        totalTasks={totalTasks}
                        mobileSecondaryOnly
                    />
                ) : null}

                <TasksCardView
                    tasks={serializedTasks}
                    allServices={allServices}
                    initialActiveTimer={initialActiveTimer}
                    projects={activeProjects}
                    view="grid"
                    cols={1}
                />

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-[var(--shadow-apple)] space-y-2">
                    <div className="flex items-center justify-between">
                        <span>Page {page}/{totalPages}</span>
                        <span>{totalTasks} tasks</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        {prevPage ? (
                            <Link className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" href={buildPageHref(prevPage)}>
                                Previous
                            </Link>
                        ) : (
                            <span className="inline-flex h-7 items-center rounded-full border border-slate-200 px-3 text-[11px] text-slate-400">Previous</span>
                        )}
                        {nextPage ? (
                            <Link className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" href={buildPageHref(nextPage)}>
                                Next
                            </Link>
                        ) : (
                            <span className="inline-flex h-7 items-center rounded-full border border-slate-200 px-3 text-[11px] text-slate-400">Next</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden md:block space-y-4">
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
