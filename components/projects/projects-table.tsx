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
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
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
    Globe,
    Users,
    ExternalLink,
    Clock,
    CheckCircle2,
    Calendar,
    Settings,
    LayoutGrid,
    CircleDollarSign,
    Target,
    Layers,
    X,
    FolderOpen,
    Trash2,
    Plus,
    Check,
    AlertCircle,
    Loader2
} from "lucide-react"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions"
import { toast } from "sonner"
import { BulkActionsBar } from "@/components/projects/bulk-actions-bar"
import { Checkbox } from "@/components/ui/checkbox"

interface ProjectTableProps {
    projects: any[]
    allServices: any[]
}

export function ProjectsTable({ projects, allServices }: ProjectTableProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isEditingServices, setIsEditingServices] = React.useState(false)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [localName, setLocalName] = React.useState("")

    // Sync localName with selectedProject
    React.useEffect(() => {
        if (selectedProject) {
            setLocalName(selectedProject.name || getProjectDisplayName(selectedProject))
        }
    }, [selectedProject])

    // Derived from projects
    const recurringProjects = projects.filter(p => p.services?.[0]?.isRecurring)
    const oneTimeProjects = projects.filter(p => !p.services?.[0]?.isRecurring)

    const getProjectDisplayName = (project: any) => {
        if (project.name) return project.name

        const serviceNames = project.services?.map((s: any) => s.serviceName).join(" & ") || "Generic Project"
        const base = `${project.site.domainName} - ${serviceNames}`
        if (project.services?.[0]?.isRecurring) {
            return `${base} - ${format(new Date(), "MMMM")}`
        }
        return base
    }

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

    const toggleService = (serviceId: string) => {
        if (!selectedProject) return

        const currentServices = selectedProject.services || []
        const currentIds = currentServices.map((s: any) => s.id)
        let nextIds: string[]

        if (currentIds.includes(serviceId)) {
            // Remove service (ensure at least one remains)
            if (currentIds.length === 1) {
                toast.error("Project must have at least one service.")
                return
            }
            nextIds = currentIds.filter((id: string) => id !== serviceId)
        } else {
            // Add service
            const serviceToAdd = allServices.find(s => s.id === serviceId)
            if (!serviceToAdd) return

            // If project is empty or we are forcing a switch
            if (currentServices.length === 0) {
                nextIds = [serviceId]
            } else {
                // Check if same kind as first existing service
                const firstService = currentServices[0]
                if (serviceToAdd.isRecurring !== firstService.isRecurring) {
                    toast.error(`Type Mismatch: This project is ${firstService.isRecurring ? 'Recurring' : 'One-time'}. You cannot mix types. To switch, remove existing services first.`, {
                        icon: <AlertCircle className="h-4 w-4 text-rose-500" />
                    })
                    return
                }
                nextIds = [...currentIds, serviceId]
            }
        }

        handleUpdate(selectedProject.id, { serviceIds: nextIds })
    }

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
                    <Link
                        href={`/vault/${project.site.partner.id}/${project.site.id}`}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-all group/site"
                    >
                        <Globe className="h-3 w-3 opacity-50 group-hover/site:opacity-100" />
                        Site Vault
                    </Link>
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
                    setIsEditingServices(false)
                }
            }}>
                <SheetContent side="right" className="sm:max-w-[800px] w-full p-0 flex flex-col border-none shadow-2xl">
                    {selectedProject && (
                        <>
                            <SheetHeader className="p-8 border-b bg-muted/20 relative">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                        <Link href={`/vault/${selectedProject.site.partner.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                            <Users className="h-3 w-3" />
                                            {selectedProject.site.partner.name}
                                        </Link>
                                        <span className="opacity-30">/</span>
                                        <Link href={`/vault/${selectedProject.site.partner.id}/${selectedProject.site.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                            <Globe className="h-3 w-3" />
                                            {selectedProject.site.domainName}
                                        </Link>
                                    </div>
                                    <SheetTitle className="group relative">
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Input
                                                    value={localName}
                                                    onChange={(e) => setLocalName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && localName !== (selectedProject.name || getProjectDisplayName(selectedProject))) {
                                                            handleUpdate(selectedProject.id, { name: localName })
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setLocalName(selectedProject.name || getProjectDisplayName(selectedProject))
                                                        }
                                                    }}
                                                    className="text-5xl font-black italic tracking-tighter border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto pr-24"
                                                    placeholder="Project Nickname"
                                                />
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {updatingId === selectedProject.id ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                    ) : (
                                                        localName !== (selectedProject.name || getProjectDisplayName(selectedProject)) && (
                                                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                                    onClick={() => handleUpdate(selectedProject.id, { name: localName })}
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                                                    onClick={() => setLocalName(selectedProject.name || getProjectDisplayName(selectedProject))}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            {localName !== (selectedProject.name || getProjectDisplayName(selectedProject)) && (
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                                    Unsaved Changes
                                                </div>
                                            )}
                                        </div>
                                    </SheetTitle>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProject.services?.map((s: any) => (
                                                <Link key={s.id} href="/services">
                                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 transition-colors">
                                                        {s.serviceName}
                                                    </Badge>
                                                </Link>
                                            )) || <span className="text-xs text-muted-foreground italic">No services assigned</span>}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] font-black uppercase tracking-tighter"
                                            onClick={() => setIsEditingServices(!isEditingServices)}
                                        >
                                            {isEditingServices ? "Cancel" : "Manage Services"}
                                        </Button>
                                    </div>

                                    {isEditingServices && (
                                        <div className="bg-background border p-4 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    Service Library
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">
                                                    Active Project Type: {selectedProject.services?.[0]?.isRecurring ? "Recurring" : "One-time"}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                                                <div className="space-y-2">
                                                    <div className="text-[9px] font-black uppercase text-rose-500/60 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Recurring
                                                    </div>
                                                    {allServices.filter(s => s.isRecurring).map(s => {
                                                        const isSelected = selectedProject.services?.some((ps: any) => ps.id === s.id)
                                                        return (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => toggleService(s.id)}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all",
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/20"
                                                                        : "bg-muted/20 border-transparent hover:border-primary/20 text-muted-foreground hover:text-foreground"
                                                                )}
                                                            >
                                                                <span className="text-[10px] truncate">{s.serviceName}</span>
                                                                {isSelected && <Check className="h-3 w-3" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="text-[9px] font-black uppercase text-emerald-500/60 flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> One-Time
                                                    </div>
                                                    {allServices.filter(s => !s.isRecurring).map(s => {
                                                        const isSelected = selectedProject.services?.some((ps: any) => ps.id === s.id)
                                                        return (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => toggleService(s.id)}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all",
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/20"
                                                                        : "bg-muted/20 border-transparent hover:border-primary/20 text-muted-foreground hover:text-foreground"
                                                                )}
                                                            >
                                                                <span className="text-[10px] truncate">{s.serviceName}</span>
                                                                {isSelected && <Check className="h-3 w-3" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-muted-foreground italic flex items-start gap-1 p-2 bg-muted/30 rounded-lg">
                                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                                To switch project type, you must first remove all current services of the other type.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-12 text-sm">
                                {/* EDITABLE CONTROLS SECTION */}
                                <section className="grid grid-cols-2 gap-6 bg-muted/20 p-6 rounded-2xl border border-dashed">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lifecycle Status</Label>
                                        <Select
                                            defaultValue={selectedProject.status}
                                            onValueChange={(val) => handleUpdate(selectedProject.id, { status: val })}
                                        >
                                            <SelectTrigger className="h-11 bg-background border-none shadow-sm font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Paused">Paused</SelectItem>
                                                <SelectItem value="Completed">Completed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ledger Status</Label>
                                        <Select
                                            defaultValue={selectedProject.paymentStatus}
                                            onValueChange={(val) => handleUpdate(selectedProject.id, { paymentStatus: val })}
                                        >
                                            <SelectTrigger className={cn(
                                                "h-11 bg-background border-none shadow-sm font-black italic",
                                                selectedProject.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Paid">PAID</SelectItem>
                                                <SelectItem value="Unpaid">UNPAID</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
                                            Contract Fee (RON)
                                            <span className="text-primary/40 font-mono">Current: {selectedProject.currentFee}</span>
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40">RON</span>
                                            <Input
                                                type="number"
                                                defaultValue={selectedProject.currentFee}
                                                className="h-11 bg-background border-none shadow-sm pl-12 font-black italic text-lg"
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value)
                                                    if (val !== selectedProject.currentFee) {
                                                        handleUpdate(selectedProject.id, { currentFee: val })
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* TASKS SECTION */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-primary" /> Service Checklist
                                    </h3>
                                    <ProjectTasks
                                        projectId={selectedProject.id}
                                        initialTasks={selectedProject.tasks || []}
                                    />
                                </section>

                                {/* SITE CONTEXT SECTION */}
                                <section className="space-y-6 pt-6 border-t border-dashed">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                        <Target className="h-4 w-4 text-primary" /> Context & Technicals
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        <Link
                                            href={`/vault/${selectedProject.site.partner.id}`}
                                            className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all group"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Partner Entity</div>
                                                <div className="font-bold text-sm group-hover:text-primary transition-colors">{selectedProject.site.partner.name}</div>
                                            </div>
                                            <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </Link>

                                        <Link
                                            href={`/vault/${selectedProject.site.partner.id}/${selectedProject.site.id}`}
                                            className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all group"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Domain Asset</div>
                                                <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{selectedProject.site.domainName}</div>
                                            </div>
                                            <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </Link>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                                            <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">GTM ID</div>
                                            <div className="font-mono text-xs font-bold text-muted-foreground">{selectedProject.site.gtmId || "UNSET"}</div>
                                        </div>
                                        <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                                            <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">ADS ID</div>
                                            <div className="font-mono text-xs font-bold text-muted-foreground">{selectedProject.site.googleAdsId || "UNSET"}</div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="p-8 border-t bg-muted/20 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Initialization Date</div>
                                        <div className="text-sm font-bold">{format(new Date(selectedProject.createdAt), "MMMM do, yyyy")}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] font-mono font-medium text-muted-foreground opacity-40 italic">
                                    Last edit {formatDistanceToNow(new Date(selectedProject.updatedAt))} ago
                                </div>
                            </div>
                        </>
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
