"use client"

import * as React from "react"
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { formatProjectName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    CheckCircle2,
    Users,
    Globe,
    CreditCard,
    MoreHorizontal,
    Expand,
    ExternalLink
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
            <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[280px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Project / Domain</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Partner</TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-center">Status</TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 text-center">Payment</TableHead>
                <TableHead className="w-[140px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Fee (RON)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Metrics</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Activity</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
            </TableRow>
        </TableHeader>
    )

    const renderProjectRow = (project: any) => (
        <TableRow
            key={project.id}
            className="transition-all duration-200 group cursor-pointer hover:bg-muted/50 border-border"
        >
            <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={selectedIds.includes(project.id)}
                    onCheckedChange={() => toggleSelectProject(project.id)}
                    aria-label={`Select ${getProjectDisplayName(project)}`}
                    className={cn(
                        "rounded-[4px] border-border transition-all duration-200",
                        selectedIds.includes(project.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                />
            </TableCell>
            <TableCell onClick={() => setSelectedProject(project)}>
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[13px] tracking-tight group-hover:text-primary transition-colors">
                        {getProjectDisplayName(project)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">{formatProjectName(project)}</span>
                </div>
            </TableCell>
            <TableCell>
                <Link
                    href={`/vault/${project.site.partner.id}`}
                    className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/60 hover:text-primary transition-all group/partner"
                >
                    <Users className="h-3 w-3 opacity-40 group-hover/partner:opacity-100" />
                    {project.site.partner.name}
                </Link>
            </TableCell>

            <TableCell className="text-center">
                <Select
                    defaultValue={project.status}
                    onValueChange={(val) => handleUpdate(project.id, { status: val })}
                    disabled={updatingId === project.id}
                >
                    <SelectTrigger className="h-7 text-[10px] font-bold uppercase tracking-wider border-none bg-muted/50 hover:bg-muted px-2 py-0 mx-auto w-fit min-w-[80px] rounded-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        <SelectItem value="Active" className="text-[10px] font-bold">Active</SelectItem>
                        <SelectItem value="Paused" className="text-[10px] font-bold">Paused</SelectItem>
                        <SelectItem value="Completed" className="text-[10px] font-bold">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="text-center">
                <Select
                    defaultValue={project.paymentStatus}
                    onValueChange={(val) => handleUpdate(project.id, { paymentStatus: val })}
                    disabled={updatingId === project.id}
                >
                    <SelectTrigger className={cn(
                        "h-7 text-[10px] font-bold uppercase tracking-wider border-none px-2 py-0 mx-auto w-fit min-w-[80px] rounded-full",
                        project.paymentStatus === "Paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                    )}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        <SelectItem value="Paid" className="text-[10px] font-bold text-emerald-600">Paid</SelectItem>
                        <SelectItem value="Unpaid" className="text-[10px] font-bold text-rose-600">Unpaid</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground/60">RON</span>
                    <Input
                        type="number"
                        defaultValue={project.currentFee || 0}
                        onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (val !== project.currentFee) {
                                handleUpdate(project.id, { currentFee: val })
                            }
                        }}
                        className="h-7 text-xs w-20 bg-muted/30 border-border focus-visible:ring-primary/20 p-1 font-mono rounded-md"
                    />
                </div>
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-[11px]">
                <div className="flex items-center gap-2 font-semibold text-muted-foreground/80">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    {project._count?.tasks || 0} <span className="text-[10px] opacity-40 font-normal">Tasks</span>
                </div>
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-[10px] text-muted-foreground/60 font-medium">
                {formatDistanceToNow(new Date(project.updatedAt))} ago
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-[10px] text-muted-foreground/60">
                {format(new Date(project.createdAt), "dd MMM yyyy")}
            </TableCell>
        </TableRow>
    )

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
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>

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
