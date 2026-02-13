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
            <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">
                    <Checkbox
                        checked={selectedIds.length === projects.length && projects.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                    />
                </TableHead>
                <TableHead className="w-[280px]">Project Name</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[120px]">Payment</TableHead>
                <TableHead className="w-[140px]">Fee (RON)</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Created</TableHead>
            </TableRow>
        </TableHeader>
    )

    const renderProjectRow = (project: any) => (
        <TableRow
            key={project.id}
            className="transition-colors group cursor-pointer"
        >
            <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={selectedIds.includes(project.id)}
                    onCheckedChange={() => toggleSelectProject(project.id)}
                    aria-label={`Select ${getProjectDisplayName(project)}`}
                />
            </TableCell>
            <TableCell onClick={() => setSelectedProject(project)}>
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {getProjectDisplayName(project)}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-col gap-1.5">
                    <Link
                        href={`/vault/${project.site.partner.id}`}
                        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-all group/partner"
                    >
                        <Users className="h-3 w-3 opacity-50 group-hover/partner:opacity-100" />
                        {project.site.partner.name}
                    </Link>
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSite(project.site)
                        }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-all group/site cursor-pointer"
                    >
                        <Globe className="h-3 w-3 opacity-50 group-hover/site:opacity-100" />
                        Site Vault
                    </div>
                </div>
            </TableCell>

            <TableCell>
                <Select
                    defaultValue={project.status}
                    onValueChange={(val) => handleUpdate(project.id, { status: val })}
                    disabled={updatingId === project.id}
                >
                    <SelectTrigger className="h-8 text-xs border-none bg-transparent hover:bg-muted/50 p-1 w-[100px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Paused">Paused</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <Select
                    defaultValue={project.paymentStatus}
                    onValueChange={(val) => handleUpdate(project.id, { paymentStatus: val })}
                    disabled={updatingId === project.id}
                >
                    <SelectTrigger className={cn(
                        "h-8 text-xs font-bold border-none w-[100px] p-1",
                        project.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"
                    )}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Paid" className="text-emerald-600 font-bold">Paid</SelectItem>
                        <SelectItem value="Unpaid" className="text-rose-600 font-bold">Unpaid</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">RON</span>
                    <Input
                        type="number"
                        defaultValue={project.currentFee || 0}
                        onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (val !== project.currentFee) {
                                handleUpdate(project.id, { currentFee: val })
                            }
                        }}
                        className="h-8 text-xs w-20 bg-transparent border-none focus-visible:ring-1 p-1 font-mono"
                    />
                </div>
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                    {project._count?.tasks || 0}
                </div>
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-[10px] text-muted-foreground italic">
                {formatDistanceToNow(new Date(project.updatedAt))} ago
            </TableCell>

            <TableCell onClick={() => setSelectedProject(project)} className="text-[10px] text-muted-foreground">
                {format(new Date(project.createdAt), "dd MMM yyyy")}
            </TableCell>
        </TableRow>
    )

    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-card/50 overflow-hidden backdrop-blur-sm">
                <Table>
                    {renderHeader()}
                    <TableBody>
                        {/* Recurring Group */}
                        {recurringProjects.length > 0 && (
                            <>
                                <TableRow className="bg-muted/40 hover:bg-muted/40 pointer-events-none sticky top-0 z-10">
                                    <TableCell colSpan={9} className="py-2 px-4">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-primary/20 text-primary border-none text-[10px] h-4 flex items-center font-bold">MONTHLY</Badge>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Subscription Revenue</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {recurringProjects.map(renderProjectRow)}
                            </>
                        )}

                        {/* One-Time Group */}
                        {oneTimeProjects.length > 0 && (
                            <>
                                <TableRow className="bg-muted/40 hover:bg-muted/40 pointer-events-none sticky top-0 z-10">
                                    <TableCell colSpan={9} className="py-2 px-4 border-t">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] h-4 flex items-center font-bold">ONE-TIME</Badge>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Project Contracts</span>
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
                <SheetContent side="right" className="sm:max-w-[800px] w-full p-0 flex flex-col border-none shadow-2xl">
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
                <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background shadow-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                // Since sites are nested in projects, updating local state here is tricky without refetching projects
                                // But we can update the selectedSite local state at least
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
