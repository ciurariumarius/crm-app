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
    Plus
} from "lucide-react"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions"
import { toast } from "sonner"
import { BulkActionsBar } from "@/components/projects/bulk-actions-bar"
import { Checkbox } from "@/components/ui/checkbox"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { getProjectDisplayName } from "@/lib/project-utils"
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
}

export function ProjectsTable({ projects, allServices }: ProjectTableProps) {
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
        <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40 border-b">
                <TableHead className="w-[40px] pl-4"></TableHead>
                <TableHead className="w-[250px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 h-10">Project</TableHead>
                <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 h-10">Status</TableHead>
                <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 text-center h-10">Partner</TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 h-10">Payment</TableHead>
                <TableHead className="w-[160px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 h-10">Progress</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 h-10">Created</TableHead>
                <TableHead className="w-[100px] h-10"></TableHead>
            </TableRow>
        </TableHeader>
    )

    const renderProjectRow = (project: any) => {
        const isPaused = project.status === "Paused"
        const isCompleted = project.status === "Completed"
        const isActive = project.status === "Active"

        const statusColor = isActive ? "text-foreground font-bold" : isPaused ? "text-muted-foreground" : "text-muted-foreground/50 line-through"

        return (
            <TableRow
                key={project.id}
                className="group hover:bg-muted/30 border-b border-border/40 transition-colors data-[state=selected]:bg-muted"
            >
                <TableCell className="pl-4 py-2">
                    <Checkbox
                        checked={selectedIds.includes(project.id)}
                        onCheckedChange={() => toggleSelectProject(project.id)}
                        className={cn(
                            "rounded-[4px] border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all",
                            selectedIds.includes(project.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                    />
                </TableCell>

                <TableCell className="py-2" onClick={() => setSelectedProject(project)}>
                    <div className="flex flex-col cursor-pointer">
                        <span className={cn("text-[13px] leading-tight transition-colors", statusColor)}>
                            {formatProjectName(project)}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/50 font-medium truncate max-w-[200px]">
                                {project.site.domainName}
                            </span>
                        </div>
                    </div>
                </TableCell>

                <TableCell className="py-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                                    isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" :
                                        isPaused ? "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" :
                                            "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                )}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {project.status}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Active" })} className="text-xs font-bold text-emerald-600">Active</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Paused" })} className="text-xs font-bold text-amber-600">Paused</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdate(project.id, { status: "Completed" })} className="text-xs font-bold text-slate-600">Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>

                <TableCell className="text-center py-2">
                    <div
                        className="flex justify-center"
                        title={project.site.partner.name}
                    >
                        <Avatar className="h-6 w-6 border border-border/50 cursor-help">
                            {project.site.partner.icon ? (
                                <AvatarImage src={project.site.partner.icon} />
                            ) : null}
                            <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                                {project.site.partner.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </TableCell>

                <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all hover:opacity-80",
                                        project.paymentStatus === "Paid"
                                            ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                                            : "bg-rose-100 border-rose-200 text-rose-700"
                                    )}>
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            project.paymentStatus === "Paid" ? "bg-emerald-500" : "bg-rose-500"
                                        )} />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">
                                            {project.paymentStatus === "Paid" ? "PAID" : "UNPAID"}
                                        </span>
                                    </div>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Paid" })} className="text-xs font-bold text-emerald-600">Paid</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdate(project.id, { paymentStatus: "Unpaid" })} className="text-xs font-bold text-rose-600">Unpaid</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                className="h-6 text-[11px] font-medium bg-transparent border-transparent hover:bg-muted/50 focus:bg-muted/50 focus:ring-0 p-0 w-16 text-right cursor-text rounded transition-colors"
                            />
                            <span className="text-[9px] text-muted-foreground/50 ml-1 font-bold">RON</span>
                        </div>
                    </div>
                </TableCell>

                <TableCell className="py-2">
                    <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedProject(project)}>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium bg-muted/40 px-2 py-1 rounded-md" title="Time Tracked">
                            <Clock className="h-3 w-3 opacity-70" />
                            <span className="font-mono">
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
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium" title="Tasks Completed">
                            <CheckCircle2 className="h-3 w-3 opacity-70" />
                            <span>{project._count?.tasks || 0}</span>
                        </div>
                    </div>
                </TableCell>

                <TableCell className="py-2 text-[10px] text-muted-foreground/40 font-mono">
                    {format(new Date(project.createdAt), "dd MMM")}
                </TableCell>

                <TableCell className="py-2 pr-2">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProject(project)
                            }}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                            onClick={(e) => {
                                e.stopPropagation()
                                // TODO: Implement delete or confirm dialog
                            }}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
        )
    }

    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <Table>
                    {renderHeader()}
                    <TableBody>
                        {/* Recurring Group */}
                        {recurringProjects.length > 0 && (
                            <>
                                <TableRow className="bg-indigo-50/40 hover:bg-indigo-50/40 border-y border-indigo-100/50 pointer-events-none sticky top-0 z-10 backdrop-blur-sm">
                                    <TableCell colSpan={9} className="py-3 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-sm" />
                                            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-700">Monthly Projects</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {recurringProjects.map(renderProjectRow)}
                                <TableRow
                                    className="group hover:bg-muted/10 border-b border-dashed border-border/60 transition-colors cursor-pointer"
                                    onClick={() => setCreateProjectOpen(true)}
                                >
                                    <TableCell colSpan={9} className="py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 group-hover:text-primary transition-colors">
                                            <Plus className="h-3 w-3" />
                                            Add New Recurring Project
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </>
                        )}

                        {/* One-Time Group */}
                        {oneTimeProjects.length > 0 && (
                            <>
                                <TableRow className="bg-slate-50/40 hover:bg-slate-50/40 border-y border-slate-100/50 pointer-events-none sticky top-0 z-10 backdrop-blur-sm">
                                    <TableCell colSpan={9} className="py-3 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-500 shadow-sm" />
                                            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-700">One Time Projects</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {oneTimeProjects.map(renderProjectRow)}
                                <TableRow
                                    className="group hover:bg-muted/10 border-b border-dashed border-border/60 transition-colors cursor-pointer"
                                    onClick={() => setCreateProjectOpen(true)}
                                >
                                    <TableCell colSpan={9} className="py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 group-hover:text-primary transition-colors">
                                            <Plus className="h-3 w-3" />
                                            Add New One-Time Project
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </>
                        )}
                    </TableBody>
                    {/* Table Footer with Summaries */}
                    <tfoot className="bg-muted/40 font-bold border-t border-border">
                        <TableRow className="hover:bg-muted/40">
                            <TableCell colSpan={4} className="pl-6 h-12 text-[11px] uppercase tracking-wider text-muted-foreground">
                                Total: {projects.length} Projects
                            </TableCell>
                            <TableCell className="h-12">
                                <span className="text-[11px] font-mono text-foreground/80">
                                    {projects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0).toLocaleString()} <span className="text-[9px] text-muted-foreground">RON</span>
                                </span>
                            </TableCell>
                            <TableCell className="h-12">
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground/80">
                                    <Clock className="h-3 w-3 opacity-50" />
                                    {(() => {
                                        const totalSeconds = projects.reduce((acc, p) => {
                                            const projectSeconds = p.tasks?.reduce((tAcc: number, t: any) => {
                                                const taskSeconds = t.timeLogs?.reduce((lAcc: number, l: any) => lAcc + (l.durationSeconds || 0), 0) || 0
                                                return tAcc + taskSeconds
                                            }, 0) || 0
                                            return acc + projectSeconds
                                        }, 0)
                                        const h = Math.floor(totalSeconds / 3600)
                                        const m = Math.floor((totalSeconds % 3600) / 60)
                                        return `${h}h ${m}m`
                                    })()}
                                </div>
                            </TableCell>
                            <TableCell colSpan={2} />
                        </TableRow>
                    </tfoot>
                </Table>
            </div>

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
