"use client"

import * as React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Sheet,
    SheetContent
} from "@/components/ui/sheet"
import { formatProjectName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    CheckCircle2,
    Clock,
    Pencil,
    Trash2,
    Plus,
    Activity,
    Sparkles,
    MoreVertical
} from "lucide-react"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions/projects"
import { toast } from "sonner"
import { BulkActionsBar } from "@/components/projects/bulk-actions-bar"
import { Checkbox } from "@/components/ui/checkbox"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ProjectTableProps {
    projects: any[]
    allServices: any[]
    layout?: "grid" | "list"
}

export function ProjectsTable({ projects, allServices, layout = "grid" }: ProjectTableProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const [selectedSite, setSelectedSite] = React.useState<any>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])



    // Derived from projects
    const recurringProjects = projects.filter(p => p.services?.[0]?.isRecurring)
    const oneTimeProjects = projects.filter(p => !p.services?.[0]?.isRecurring)

    const handleUpdate = async (projectId: string, data: any) => {
        setUpdatingId(projectId)
        try {
            const result = await updateProject(projectId, data)
            if (result.success) {
                toast.success("Project updated")

                if (selectedProject?.id === projectId) {
                    if (data.serviceIds) {
                        const newServices = allServices.filter(s => data.serviceIds.includes(s.id))
                        setSelectedProject((prev: any) => ({ ...prev, services: newServices }))
                    } else {
                        setSelectedProject((prev: any) => ({ ...prev, ...data }))
                    }
                }
            } else {
                toast.error(result.error || "Update failed")
            }
        } catch (error) {
            toast.error("Update failed")
        } finally {
            setUpdatingId(null)
        }
    }

    // toggleService moved to ProjectSheetContent

    const toggleSelectAll = () => {
        if (selectedIds.length === projects.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(projects.map(p => p.id))
        }
    }

    const toggleSelectProject = (projectId: string) => {
        setSelectedIds(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        )
    }

    const renderHeader = () => (
        <div className={cn("hidden md:flex items-center px-4 mb-3 text-[10px] font-extrabold pb-2 uppercase tracking-widest text-muted-foreground/40 w-full min-w-[800px]", layout === "grid" && "hidden")}>
            <div className="w-[120px] pl-2 shrink-0">Status</div>
            <div className="flex-1 min-w-[200px] shrink-0">Project name & url</div>
            <div className="w-[100px] shrink-0 text-center">Partner</div>
            <div className="w-[120px] shrink-0 text-center">Payment</div>
            <div className="w-[120px] shrink-0 pl-4">Amount</div>
            <div className="w-[160px] shrink-0 pl-1">Activity tracking</div>
            <div className="w-[100px] shrink-0">Created</div>
        </div>
    )

    const renderGridCard = (project: any, isMonthly: boolean) => {
        const isPaused = project.status === "Paused"
        const isCompleted = project.status === "Completed"
        const isActive = project.status === "Active"

        const statusColor = isActive ? "text-foreground font-bold" : isPaused ? "text-muted-foreground" : "text-muted-foreground/50 line-through"
        const totalSeconds = project.tasks?.reduce((acc: number, task: any) => {
            const taskLogs = task.timeLogs?.reduce((lAcc: number, log: any) => lAcc + (log.durationSeconds || 0), 0) || 0
            return acc + taskLogs
        }, 0) || 0
        const h = Math.floor(totalSeconds / 3600)
        const m = Math.floor((totalSeconds % 3600) / 60)

        const tasksDone = project._count?.tasks || 0

        return (
            <div
                key={project.id}
                className={cn(
                    "group relative flex flex-col bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 border border-border/40 hover:border-border/80 transition-all duration-300 cursor-pointer overflow-hidden",
                    isMonthly ? "border-l-[6px] border-l-blue-600" : "border-l-[6px] border-l-emerald-500"
                )}
                onClick={() => setSelectedProject(project)}
            >
                {/* Top Row: Pills and Menu */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {/* Status Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                        isActive ? "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20" :
                                            isPaused ? "bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20" :
                                                "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Activity className="h-3 w-3" />
                                    {project.status}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-[10px] font-bold text-blue-500 tracking-wider uppercase p-2 cursor-pointer">Active</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-[10px] font-bold text-amber-600 tracking-wider uppercase p-2 cursor-pointer">Paused</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-[10px] font-bold text-slate-500 tracking-wider uppercase p-2 cursor-pointer">Completed</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Type Pill */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 dark:bg-zinc-800/50 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            {isMonthly ? "MONTHLY" : "ONE-TIME"}
                        </div>
                    </div>

                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>

                {/* Middle Row: Project Info */}
                <div className="flex flex-col mb-6">
                    <span className={cn("text-lg font-black tracking-tight leading-tight line-clamp-2 mb-1", statusColor)}>
                        {formatProjectName(project)}
                    </span>
                    <span className="text-xs text-blue-500/70 font-medium truncate">
                        {project.site.domainName}
                    </span>
                </div>

                {/* Bottom Row: Partner, Payment, Amount */}
                <div className="flex items-end justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {/* Partner Avatar Wrapper */}
                        <div title={project.site.partner.name}>
                            <Avatar className="h-10 w-10 border-0 bg-zinc-950 dark:bg-zinc-100">
                                {project.site.partner.icon ? (
                                    <AvatarImage src={project.site.partner.icon} />
                                ) : null}
                                <AvatarFallback className="text-xs text-white dark:text-black font-extrabold uppercase bg-transparent">
                                    {project.site.partner.name.substring(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        {/* Payment Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border border-transparent hover:border-border/30",
                                        project.paymentStatus === "Paid"
                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                                            : "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                                    )}>
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                        )} />
                                        <span className="text-[9px] font-extrabold uppercase tracking-widest">
                                            {project.paymentStatus === "Paid" ? "PAID" : "UNPAID"}
                                        </span>
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest p-2 cursor-pointer">Paid</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest p-2 cursor-pointer">Unpaid</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Amount */}
                    <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                            type="number"
                            defaultValue={project.currentFee || 0}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== project.currentFee) {
                                    handleUpdate(project.id, { currentFee: val })
                                }
                            }}
                            className="h-auto p-0 border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 text-xl md:text-2xl font-black text-right w-20 shadow-none -mb-1"
                        />
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">RON</span>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-3 mt-auto pt-2">
                    <div className="flex-1 flex flex-col gap-1 p-3 rounded-[16px] border border-border/40 bg-zinc-50/50 dark:bg-zinc-800/30">
                        <span className="text-[8px] font-extrabold text-muted-foreground/60 uppercase tracking-widest">TIME TRACKED</span>
                        <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            {h}h {m}m
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-1 p-3 rounded-[16px] border border-border/40 bg-zinc-50/50 dark:bg-zinc-800/30">
                        <span className="text-[8px] font-extrabold text-muted-foreground/60 uppercase tracking-widest">TASKS DONE</span>
                        <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {tasksDone} tasks
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderProjectCard = (project: any) => {
        const isPaused = project.status === "Paused"
        const isCompleted = project.status === "Completed"
        const isActive = project.status === "Active"

        const statusColor = isActive ? "text-foreground font-bold" : isPaused ? "text-muted-foreground" : "text-muted-foreground/50 line-through"

        return (
            <div
                key={project.id}
                className="group relative flex items-center bg-white dark:bg-zinc-900 rounded-[24px] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 border border-border/40 hover:border-border/80 transition-all duration-300 w-full cursor-pointer overflow-x-auto min-w-[800px]"
                onClick={() => setSelectedProject(project)}
            >
                {/* 1. Status Pill */}
                <div className="w-[120px] shrink-0 pl-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                                    isActive ? "bg-blue-50 text-blue-500 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20" :
                                        isPaused ? "bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20" :
                                            "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                                )}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {project.status}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-[10px] font-bold text-blue-500 tracking-wider uppercase p-2 cursor-pointer">Active</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-[10px] font-bold text-amber-600 tracking-wider uppercase p-2 cursor-pointer">Paused</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-[10px] font-bold text-slate-500 tracking-wider uppercase p-2 cursor-pointer">Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 2. Project Name & URL */}
                <div className="flex-1 min-w-[200px] shrink-0">
                    <div className="flex flex-col pr-4">
                        <span className={cn("text-sm font-black tracking-tight", statusColor)}>
                            {formatProjectName(project)}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-blue-500/60 dark:text-blue-400/60 font-medium truncate max-w-[200px]">
                                {project.site.domainName}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Partner Avatar */}
                <div className="w-[100px] shrink-0 flex items-center justify-center">
                    <div
                        className="flex justify-center"
                        title={project.site.partner.name}
                    >
                        <Avatar className="h-8 w-8 border border-border/80">
                            {project.site.partner.icon ? (
                                <AvatarImage src={project.site.partner.icon} />
                            ) : null}
                            <AvatarFallback className="text-[10px] bg-white dark:bg-zinc-800 font-bold text-muted-foreground uppercase">
                                {project.site.partner.name.substring(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                {/* 4. Payment */}
                <div className="w-[120px] shrink-0 flex items-center justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border border-transparent hover:border-border/30",
                                    project.paymentStatus === "Paid"
                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                                        : "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                                )}>
                                    <div className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                    )} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                        {project.paymentStatus === "Paid" ? "PAID" : "UNPAID"}
                                    </span>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest p-2 cursor-pointer">Paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest p-2 cursor-pointer">Unpaid</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 5. Amount */}
                <div className="w-[120px] shrink-0 flex items-center justify-start pl-4">
                    <div className="relative group/fee flex items-center">
                        <Input
                            type="number"
                            defaultValue={project.currentFee || 0}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== project.currentFee) {
                                    handleUpdate(project.id, { currentFee: val })
                                }
                            }}
                            className="h-8 text-sm font-bold bg-transparent border-transparent hover:bg-muted/50 focus:bg-muted/50 focus:ring-0 p-0 w-16 text-right cursor-text rounded transition-colors"
                        />
                        <span className="text-xs text-muted-foreground/60 ml-1 font-bold">RON</span>
                    </div>
                </div>

                {/* 6. Activity */}
                <div className="w-[160px] shrink-0 flex items-center pl-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium" title="Time Tracked">
                            <Clock className="h-3.5 w-3.5 opacity-50" />
                            <span className="font-mono text-[11px]">
                                {(() => {
                                    const totalSeconds = project.tasks?.reduce((acc: number, task: any) => {
                                        const taskLogs = task.timeLogs?.reduce((lAcc: number, log: any) => lAcc + (log.durationSeconds || 0), 0) || 0
                                        return acc + taskLogs
                                    }, 0) || 0
                                    const h = Math.floor(totalSeconds / 3600)
                                    const m = Math.floor((totalSeconds % 3600) / 60)
                                    return `${h}h ${m}m`
                                })()}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium" title="Tasks Completed">
                            <CheckCircle2 className="h-3.5 w-3.5 opacity-50 text-emerald-500" />
                            <span>{project._count?.tasks || 0}</span>
                        </div>
                    </div>
                </div>

                {/* 7. Created */}
                <div className="w-[100px] shrink-0 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-bold tracking-wide">
                        {format(new Date(project.createdAt), "dd MMM")}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-border/40 text-muted-foreground hover:text-rose-500 hover:border-rose-200 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Implement delete or confirm dialog
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

    return (
        <div className="space-y-12">
            {/* Monthly Group */}
            {recurringProjects.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1.5 rounded-full bg-blue-500 shadow-sm" />
                            <span className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground leading-none">Monthly Projects</span>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hidden md:block">
                            Subtotal: <span className="text-foreground">{recurringProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0).toLocaleString()} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {recurringProjects.map(p => renderGridCard(p, true))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-4 hidescrollbar">
                            <div className="min-w-[800px] flex flex-col gap-2">
                                {renderHeader()}
                                {recurringProjects.map(renderProjectCard)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* One-Time Group */}
            {oneTimeProjects.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1.5 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground leading-none">One-Time Projects</span>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hidden md:block">
                            Subtotal: <span className="text-foreground">{oneTimeProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0).toLocaleString()} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {oneTimeProjects.map(p => renderGridCard(p, false))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-4 hidescrollbar">
                            <div className="min-w-[800px] flex flex-col gap-2">
                                {renderHeader()}
                                {oneTimeProjects.map(renderProjectCard)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Project Dialog */}
            <GlobalCreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                partners={JSON.parse(JSON.stringify(projects.flatMap(p => p.site?.partner ? [p.site.partner] : []).filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)))} // Rough way to get partners from projects prop, ideally passed down
                services={allServices}
            />

            {/* Comprehensive Project Detail Drawer */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => {
                if (!open) {
                    setSelectedProject(null)
                }
            }}>
                <SheetContent side="right" className="sm:max-w-[800px] w-full p-0 flex flex-col border-none shadow-xl bg-background backdrop-blur-3xl overflow-hidden">
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            onUpdate={(updated) => setSelectedProject((prev: any) => ({ ...prev, ...updated }))}
                            onOpenSite={(site) => setSelectedSite(site)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site Detail Sheet */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background backdrop-blur-3xl shadow-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                setSelectedSite({ ...selectedSite, ...updated })
                            }}
                        />
                    )}
                </SheetContent>
            </Sheet>

            <BulkActionsBar
                selectedIds={selectedIds}
                onClearSelection={() => setSelectedIds([])}
                totalProjects={projects.length}
            />

        </div>
    )
}
