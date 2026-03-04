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
                            className="text-left rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-[var(--shadow-card)] transition duration-200 ease-in-out"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-lg font-bold tracking-tight text-slate-900 truncate">{project.site.domainName}</p>
                                    <p className="text-sm text-slate-500 truncate">{project.serviceLabel}</p>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] font-semibold",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700" :
                                            "bg-slate-100 text-slate-700"
                                )}>
                                    {project.status}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-slate-400 text-[11px] uppercase tracking-[0.12em]">Type</p>
                                    <p className="font-medium text-slate-700">{project.isRecurring ? "Monthly" : "One-time"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-[11px] uppercase tracking-[0.12em]">Payment</p>
                                    <p className={cn("font-medium", project.paymentStatus === "Paid" ? "text-emerald-700" : "text-rose-600")}>{project.paymentStatus}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-[11px] uppercase tracking-[0.12em]">Amount</p>
                                    <p className="font-semibold text-slate-800">{currencyFormatter.format(project.amount)} RON</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-[11px] uppercase tracking-[0.12em]">Time</p>
                                    <p className="font-medium text-slate-700">{formatDuration(project.secondsLogged)}</p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
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
                    <h2 className="text-[12px] uppercase tracking-[0.25em] font-semibold text-slate-500">Monthly Projects</h2>
                </div>

                <div className="hidden xl:grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] items-center px-5 text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold">
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
                                className="w-full text-left grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] gap-3 items-center rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:shadow-[var(--shadow-card)] hover:bg-[#F3F4F6] transition-all duration-200 ease-in-out"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{project.site.domainName}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                                        <span className="truncate">{project.serviceLabel}</span>
                                        <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 shrink-0">
                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] text-center font-semibold",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700" :
                                            "bg-slate-100 text-slate-700"
                                )}>
                                    {project.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-[11px] text-center font-semibold bg-violet-50 text-violet-700">Monthly</span>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] text-center font-semibold",
                                    project.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
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
                    <h2 className="text-[12px] uppercase tracking-[0.25em] font-semibold text-slate-500">One-time Projects</h2>
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
                                className="w-full text-left grid xl:grid-cols-[minmax(260px,2fr)_130px_110px_120px_120px_140px_110px_140px_130px] gap-3 items-center rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:shadow-[var(--shadow-card)] hover:bg-[#F3F4F6] transition-all duration-200 ease-in-out"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{project.site.domainName}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
                                        <span className="truncate">{project.serviceLabel}</span>
                                        <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] text-center font-semibold",
                                    project.status === "Active" ? "bg-blue-50 text-blue-700" :
                                        project.status === "Paused" ? "bg-amber-50 text-amber-700" :
                                            "bg-slate-100 text-slate-700"
                                )}>
                                    {project.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-[11px] text-center font-semibold bg-emerald-50 text-emerald-700">One-time</span>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] text-center font-semibold",
                                    project.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
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
