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
    MoreVertical,
    ChevronDown
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
        <div className={cn("hidden md:flex items-center px-4 mb-3 text-xs font-semibold pb-2 text-muted-foreground w-full min-w-[1100px]", layout === "grid" && "hidden")}>
            <div className="w-[120px] pl-2 shrink-0">Status</div>
            <div className="flex-1 min-w-[200px] shrink-0">Project name & url</div>
            <div className="w-[160px] shrink-0">Partner</div>
            <div className="w-[90px] shrink-0 text-center">Type</div>
            <div className="w-[120px] shrink-0 text-center">Payment</div>
            <div className="w-[150px] shrink-0 pl-6">Amount</div>
            <div className="w-[160px] shrink-0 pl-2">Activity tracking</div>
            <div className="w-[100px] shrink-0 text-right pr-4">Created</div>
        </div>
    )

    const renderGridCard = (project: any, isMonthly: boolean) => {
        const isPaused = project.status === "Paused"
        const isCompleted = project.status === "Completed"
        const isActive = project.status === "Active"

        const statusColor = isActive ? "text-foreground font-bold" : isPaused ? "text-muted-foreground" : "text-muted-foreground/50 line-through"


        return (
            <div
                key={project.id}
                className={cn(
                    "group relative flex flex-col bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm hover:shadow-md border border-border/60 hover:border-border/80 transition-all duration-300 cursor-pointer overflow-hidden",
                    isMonthly ? "border-l-[6px] border-l-blue-600" : "border-l-[6px] border-l-emerald-500"
                )}
                onClick={() => setSelectedProject(project)}
            >
                {/* 1. Top Section: Project Name */}
                <div className="flex justify-between items-start mb-3">
                    <span className={cn("text-xl md:text-2xl font-bold leading-tight tracking-tight break-words text-wrap line-clamp-2", statusColor)}>
                        {formatProjectName(project)}
                    </span>
                </div>

                {/* 2. Badges & Amount Row */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-3 gap-x-2 mb-4">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* Status Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm border",
                                        isActive ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" :
                                            isPaused ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" :
                                                "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    {project.status}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-xs font-medium text-blue-600 p-2 cursor-pointer">Active</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-xs font-medium text-amber-600 p-2 cursor-pointer">Paused</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-xs font-medium text-slate-600 p-2 cursor-pointer">Completed</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>


                        {/* Payment Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-sm border",
                                        project.paymentStatus === "Paid"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                                    )}>
                                        <div className={cn(
                                            "h-2 w-2 rounded-full",
                                            project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                        )} />
                                        <span className="text-xs font-medium">
                                            {project.paymentStatus === "Paid" ? "Paid" : "Unpaid"}
                                        </span>
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl">
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-xs font-medium text-emerald-600 p-2 cursor-pointer">Paid</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-xs font-medium text-rose-600 p-2 cursor-pointer">Unpaid</DropdownMenuItem>
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
                            className="h-auto p-0 border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 text-lg sm:text-xl font-semibold text-right w-16 shadow-none -mb-0.5"
                        />
                        <span className="text-xs font-medium text-muted-foreground/60">RON</span>
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

        const isMonthly = project.services?.[0]?.isRecurring

        return (
            <div
                key={project.id}
                className="group relative flex items-center bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm hover:shadow-md border border-border/60 hover:border-border/80 transition-all duration-300 w-full cursor-pointer overflow-x-auto min-w-[1100px]"
                onClick={() => setSelectedProject(project)}
            >
                {/* 1. Status Pill */}
                <div className="w-[120px] shrink-0 pl-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                    isActive ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/20" :
                                        isPaused ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/20" :
                                            "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700"
                                )}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {project.status}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-xs font-medium text-blue-600 p-2 cursor-pointer">Active</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-xs font-medium text-amber-600 p-2 cursor-pointer">Paused</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-xs font-medium text-slate-600 p-2 cursor-pointer">Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 2. Project Name & URL */}
                <div className="flex-1 min-w-[200px] shrink-0 flex items-center">
                    <div className="flex flex-col pr-4">
                        <span className={cn("text-base md:text-lg font-semibold tracking-tight line-clamp-2", statusColor)}>
                            {formatProjectName(project)}
                        </span>
                    </div>
                </div>

                {/* 3. Partner Name */}
                <div className="w-[160px] shrink-0 flex items-center pr-2">
                    <span className="text-sm font-medium text-foreground truncate leading-snug" title={project.site.partner.name}>
                        {project.site.partner.name}
                    </span>
                </div>

                {/* Type Pill */}
                <div className="w-[90px] shrink-0 flex items-center justify-center">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-zinc-800/50 rounded-lg text-xs font-medium text-slate-600 truncate w-full justify-center border border-slate-200 dark:border-slate-700">
                        <Sparkles className="h-3 w-3 text-amber-500 shrink-0 hidden md:block" />
                        {isMonthly ? "Monthly" : "One-Time"}
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
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border",
                                    project.paymentStatus === "Paid"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                        : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                                )}>
                                    <div className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                    )} />
                                    <span className="text-xs font-medium">
                                        {project.paymentStatus === "Paid" ? "Paid" : "Unpaid"}
                                    </span>
                                </div>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-xs font-medium text-emerald-600 p-2 cursor-pointer">Paid</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-xs font-medium text-rose-600 p-2 cursor-pointer">Unpaid</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* 5. Amount */}
                <div className="w-[150px] shrink-0 flex items-center justify-start pl-6">
                    <div className="relative group/fee flex items-baseline">
                        <Input
                            type="number"
                            defaultValue={project.currentFee || 0}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (val !== project.currentFee) {
                                    handleUpdate(project.id, { currentFee: val })
                                }
                            }}
                            className="h-10 text-base md:text-lg font-semibold bg-transparent border-transparent hover:bg-muted/50 focus:bg-muted/50 focus:ring-0 p-0 w-20 text-right cursor-text rounded transition-colors shadow-none -mb-0.5"
                        />
                        <span className="text-xs text-muted-foreground/60 ml-1.5 font-medium mt-0.5">RON</span>
                    </div>
                </div>

                {/* 6. Activity */}
                <div className="w-[160px] shrink-0 flex items-center pl-2">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium" title="Time Tracked">
                            <Clock className="h-3.5 w-3.5 opacity-50" />
                            <span className="font-mono text-xs">
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
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium" title="Tasks Completed">
                            <CheckCircle2 className="h-3.5 w-3.5 opacity-50 text-emerald-500" />
                            <span>{project._count?.tasks || 0}</span>
                        </div>
                    </div>
                </div>

                {/* 7. Created */}
                <div className="w-[140px] shrink-0 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                        {format(new Date(project.createdAt), "dd MMMM")}
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
                            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none">Monthly Projects</span>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground hidden md:block">
                            Subtotal: <span className="text-foreground">{recurringProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0).toLocaleString('en-US')} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {recurringProjects.map(p => renderGridCard(p, true))}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {recurringProjects.map(p => renderGridCard(p, true))}
                            </div>
                            <div className="hidden md:block overflow-x-auto pb-4 hidescrollbar">
                                <div className="min-w-[800px] flex flex-col gap-2">
                                    {renderHeader()}
                                    {recurringProjects.map(renderProjectCard)}
                                </div>
                            </div>
                        </>
                    )}
                    {/* Shadow Create Row */}
                    {layout === "list" && (
                        <div
                            className="bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/30 hover:border-primary/50 text-white rounded-xl flex items-center p-4 transition-all cursor-pointer mt-2 group/shadow md:min-w-[1100px]"
                            onClick={() => setCreateProjectOpen(true)}
                        >
                            <div className="w-[120px] shrink-0 flex justify-center text-primary dark:text-primary">
                                <div className="h-6 w-16 bg-primary/20 rounded-full animate-pulse" />
                            </div>
                            <div className="flex-1 px-4 flex items-center gap-3">
                                <Plus className="h-4 w-4 text-primary group-hover/shadow:text-primary transition-colors" />
                                <span className="text-sm font-semibold text-primary transition-colors">Add new project...</span>
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
                            <span className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-none">One-Time Projects</span>
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground hidden md:block">
                            Subtotal: <span className="text-foreground">{oneTimeProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0).toLocaleString('en-US')} RON</span>
                        </div>
                    </div>
                    {layout === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {oneTimeProjects.map(p => renderGridCard(p, false))}
                            {/* Shadow Card */}
                            <div
                                className="group/shadow bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-white border border-dashed border-primary/30 rounded-xl flex flex-col justify-center items-center h-[180px] transition-all cursor-pointer"
                                onClick={() => setCreateProjectOpen(true)}
                            >
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover/shadow:scale-110 group-hover/shadow:bg-primary/20 transition-all">
                                    <Plus className="h-6 w-6" strokeWidth={3} />
                                </div>
                                <span className="mt-3 text-xs font-semibold text-primary transition-colors">Start New Project</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {oneTimeProjects.map(p => renderGridCard(p, false))}
                            </div>
                            <div className="hidden md:block overflow-x-auto pb-4 hidescrollbar">
                                <div className="min-w-[800px] flex flex-col gap-2">
                                    {renderHeader()}
                                    {oneTimeProjects.map(renderProjectCard)}
                                    {/* Shadow Create Row */}
                                    <div
                                        className="bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/30 hover:border-primary/50 text-white rounded-xl flex items-center p-4 transition-all cursor-pointer min-w-[1100px] mt-2 group/shadow"
                                        onClick={() => setCreateProjectOpen(true)}
                                    >
                                        <div className="w-[120px] shrink-0 flex justify-center text-primary dark:text-primary">
                                            <div className="h-6 w-16 bg-primary/20 rounded-full animate-pulse" />
                                        </div>
                                        <div className="flex-1 px-4 flex items-center gap-3">
                                            <Plus className="h-4 w-4 text-primary group-hover/shadow:text-primary transition-colors" />
                                            <span className="text-sm font-semibold text-primary transition-colors">Add new project...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
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
                <SheetContent side="right" className="w-[90vw] sm:max-w-[800px] 2xl:max-w-[1000px] p-0 flex flex-col border-none shadow-xl bg-background backdrop-blur-3xl overflow-hidden">
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
