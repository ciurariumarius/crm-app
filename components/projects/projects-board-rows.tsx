"use client"

import * as React from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"

const currencyFormatter = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

function formatDuration(totalSeconds: number) {
    if (totalSeconds <= 0) return "0h 0m"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
}

export function ProjectsBoardRows({
    projects,
    layout,
}: {
    projects: any[]
    layout: "grid" | "list"
}) {
    const { openProject } = React.useContext(ProjectSheetContext)

    const monthlyProjects = projects.filter((project) => project.isRecurring)
    const oneTimeProjects = projects.filter((project) => !project.isRecurring)

    const openDetails = (projectId: string) => {
        openProject(projectId)
    }

    if (layout === "grid") {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project) => {
                    const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                    const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                    return (
                        <button
                            key={project.id}
                            type="button"
                            onClick={() => openDetails(project.id)}
                            className="text-left rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-border/80 transition duration-200 ease-in-out"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-lg font-bold tracking-tight text-slate-900 truncate">{project.site.domainName}</p>
                                    <p className="text-sm text-slate-500 truncate">{project.serviceLabel}</p>
                                </div>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium border",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                            "bg-slate-50 text-slate-700 border-slate-200"
                                )}>
                                    {project.status}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Type</p>
                                    <p className="font-medium text-slate-700">{project.isRecurring ? "Monthly" : "One-time"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Payment</p>
                                    <p className={cn("font-medium", project.paymentStatus === "Paid" ? "text-emerald-700" : "text-rose-600")}>{project.paymentStatus}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Amount</p>
                                    <p className="font-semibold text-slate-800">{currencyFormatter.format(project.amount)} RON</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-medium">Time</p>
                                    <p className="font-medium text-slate-700">{formatDuration(project.secondsLogged)}</p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
                                    <span>Tasks</span>
                                    <span>{project.completedTasks}/{totalTasks}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-7">
            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="h-5 w-1 rounded-full bg-violet-500" />
                    <h2 className="text-xs font-semibold text-slate-500">Monthly Projects</h2>
                </div>

                <div className="hidden xl:grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] items-center px-5 text-xs text-slate-500 font-semibold gap-3">
                    <span>Project name / service</span>
                    <span>Status</span>
                    <span>Type</span>
                    <span>Payment</span>
                    <span>Amount</span>
                    <span>Tasks</span>
                    <span>Time</span>
                    <span>Partner</span>
                    <span>Created</span>
                </div>

                <div className="space-y-2">
                    {monthlyProjects.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-slate-500">
                            No monthly projects match current filters.
                        </div>
                    )}
                    {monthlyProjects.map((project) => {
                        const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                        const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                        return (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => openDetails(project.id)}
                                className="w-full text-left grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] gap-3 items-center rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm hover:shadow-md hover:border-border/80 hover:bg-muted/50 transition-all duration-200 ease-in-out"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{project.site.domainName}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                                        <span className="truncate">{project.serviceLabel}</span>
                                        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs text-center font-medium border",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                            "bg-slate-50 text-slate-700 border-slate-200"
                                )}>
                                    {project.status}
                                </span>
                                <span className="px-3 py-1.5 rounded-lg text-xs text-center font-medium border bg-violet-50 text-violet-700 border-violet-200">Monthly</span>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs text-center font-medium border",
                                    project.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                )}>
                                    {project.paymentStatus}
                                </span>
                                <span className="font-semibold text-slate-800">{currencyFormatter.format(project.amount)} <span className="text-slate-400 text-xs">RON</span></span>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                        <span>{project.completedTasks}/{totalTasks}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-lg text-xs text-slate-600 bg-slate-50 text-center">{formatDuration(project.secondsLogged)}</span>
                                <span className="text-sm text-slate-700 truncate">{project.site.partner.name}</span>
                                <span className="text-sm text-slate-500">{format(new Date(project.createdAt), "dd MMMM")}</span>
                            </button>
                        )
                    })}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="h-5 w-1 rounded-full bg-emerald-500" />
                    <h2 className="text-xs font-semibold text-slate-500">One-time Projects</h2>
                </div>

                <div className="space-y-2">
                    {oneTimeProjects.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-slate-500">
                            No one-time projects match current filters.
                        </div>
                    )}
                    {oneTimeProjects.map((project) => {
                        const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                        const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0
                        return (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => openDetails(project.id)}
                                className="w-full text-left grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] gap-3 items-center rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm hover:shadow-md hover:border-border/80 hover:bg-muted/50 transition-all duration-200 ease-in-out"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{project.site.domainName}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                                        <span className="truncate">{project.serviceLabel}</span>
                                        <span className="text-xs font-medium px-2 py-1 rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs text-center font-medium border",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                            "bg-slate-50 text-slate-700 border-slate-200"
                                )}>
                                    {project.status}
                                </span>
                                <span className="px-3 py-1.5 rounded-lg text-xs font-medium text-center border bg-emerald-50 text-emerald-700 border-emerald-200">One-time</span>
                                <span className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs text-center font-medium border",
                                    project.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                )}>
                                    {project.paymentStatus}
                                </span>
                                <span className="font-semibold text-slate-800">{currencyFormatter.format(project.amount)} <span className="text-slate-400 text-xs">RON</span></span>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                        <span>{project.completedTasks}/{totalTasks}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-lg text-xs text-slate-600 bg-slate-50 text-center">{formatDuration(project.secondsLogged)}</span>
                                <span className="text-sm text-slate-700 truncate">{project.site.partner.name}</span>
                                <span className="text-sm text-slate-500">{format(new Date(project.createdAt), "dd MMMM")}</span>
                            </button>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
