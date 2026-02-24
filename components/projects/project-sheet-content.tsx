"use client"

import * as React from "react"
import Link from "next/link"
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
    Clock,
    CheckCircle2,
    Calendar,
    Expand,
    Trash2,
    Pencil,
    Loader2,
    AlertCircle,
    Check,
    FolderOpen,
    Target
} from "lucide-react"
import {
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { TaskSheetWrapper } from "@/components/tasks/task-sheet-wrapper"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions"
import { toast } from "sonner"

import { formatProjectName } from "@/lib/utils"
import { ProjectWithDetails } from "@/types"
import { Service, Site } from "@prisma/client"

interface ProjectSheetContentProps {
    project: ProjectWithDetails
    allServices: Service[]
    onUpdate?: (updatedProject: ProjectWithDetails) => void
    onOpenSite?: (site: Site) => void
}

export function ProjectSheetContent({ project: initialProject, allServices, onUpdate, onOpenSite }: ProjectSheetContentProps) {
    const [project, setProject] = React.useState<ProjectWithDetails>(initialProject)
    const [localName, setLocalName] = React.useState("")
    const [isEditingServices, setIsEditingServices] = React.useState(false)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isEditingTitle, setIsEditingTitle] = React.useState(false)

    // Sync state when prop changes
    React.useEffect(() => {
        setProject(initialProject)
    }, [initialProject])

    // Sync localName
    React.useEffect(() => {
        if (project) {
            setLocalName(project.name || formatProjectName(project))
        }
    }, [project])

    const handleUpdate = async (data: any) => {
        setUpdatingId(project.id)
        try {
            const result = await updateProject(project.id, data)
            if (result.success) {
                toast.success("Project updated")

                let updated
                if (data.serviceIds) {
                    const newServices = allServices.filter(s => data.serviceIds.includes(s.id))
                    updated = { ...project, services: newServices }
                } else {
                    updated = { ...project, ...data }
                }

                setProject(updated)
                if (onUpdate) onUpdate(updated)
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
        const currentServices = project.services || []
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

        handleUpdate({ serviceIds: nextIds })
    }

    return (
        <TaskSheetWrapper tasks={project.tasks || []} project={project}>
            <div className="flex flex-col h-full bg-background sm:rounded-l-2xl overflow-hidden">
                <SheetHeader className="p-8 border-b bg-muted/20 relative">

                    <div className="space-y-4 pr-12">

                        <SheetTitle className="group relative">
                            <div className="space-y-4">
                                <div className="relative">
                                    {isEditingTitle ? (
                                        <Textarea
                                            value={localName}
                                            onChange={(e) => setLocalName(e.target.value)}
                                            className="text-2xl md:text-3xl font-black tracking-tight border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto min-h-[40px] resize-none leading-tight overflow-hidden pr-24"
                                            placeholder="Project Name"
                                            rows={1}
                                            autoFocus
                                            onBlur={() => {
                                                if (localName !== (project.name || formatProjectName(project))) {
                                                    handleUpdate({ name: localName })
                                                }
                                                setIsEditingTitle(false)
                                            }}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement
                                                target.style.height = 'auto'
                                                target.style.height = `${target.scrollHeight}px`
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    if (localName !== (project.name || formatProjectName(project))) {
                                                        handleUpdate({ name: localName })
                                                    }
                                                    setIsEditingTitle(false)
                                                }
                                                if (e.key === 'Escape') {
                                                    setLocalName(project.name || formatProjectName(project))
                                                    setIsEditingTitle(false)
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                                                {localName || formatProjectName(project)}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => setIsEditingTitle(true)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {updatingId === project.id && (
                                        <div className="absolute right-0 top-1.5">
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SheetTitle>

                        {/* Controls Row */}
                        <div className="flex flex-col gap-4 pt-2">
                            <div className="flex flex-wrap items-center gap-2.5">
                                {/* Status Select */}
                                <Select
                                    value={project.status}
                                    onValueChange={(val) => handleUpdate({ status: val })}
                                >
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] border-none transition-all shadow-none focus:ring-1 p-0 px-4 rounded-full text-[10px] font-black tracking-widest uppercase [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        project.status === "Active" ? "bg-emerald-600 text-white hover:bg-emerald-700" :
                                            project.status === "Paused" ? "bg-orange-500 text-white hover:bg-orange-600" :
                                                "bg-blue-600 text-white hover:bg-blue-700"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active" className="text-xs font-bold">ACTIVE</SelectItem>
                                        <SelectItem value="Paused" className="text-xs font-bold">PAUSED</SelectItem>
                                        <SelectItem value="Completed" className="text-xs font-bold">COMPLETED</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Payment Status Select */}
                                <Select
                                    value={project.paymentStatus}
                                    onValueChange={(val) => {
                                        const updates: any = { paymentStatus: val }
                                        if (val === "Paid" && !project.paidAt) {
                                            updates.paidAt = new Date()
                                        } else if (val === "Unpaid") {
                                            updates.paidAt = null
                                        }
                                        handleUpdate(updates)
                                    }}
                                >
                                    <SelectTrigger className={cn(
                                        "h-9 w-auto min-w-[130px] border-none shadow-none focus:ring-1 transition-all p-0 px-4 rounded-full text-[10px] font-black tracking-widest uppercase [&>span]:line-clamp-1 [&>svg]:!text-current [&>svg]:!opacity-100",
                                        project.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
                                            "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Paid" className="text-xs font-bold text-emerald-600">PAID</SelectItem>
                                        <SelectItem value="Unpaid" className="text-xs font-bold text-rose-600">UNPAID</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Total Time Badge */}
                                <div className="flex items-center gap-2 h-9 text-[10px] font-black tracking-widest px-4 rounded-full border bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                                    <Clock className="h-3 w-3" strokeWidth={3} />
                                    <span>
                                        {project.timeLogs ? (
                                            (() => {
                                                const seconds = project.timeLogs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0)
                                                const hours = Math.floor(seconds / 3600)
                                                const mins = Math.floor((seconds % 3600) / 60)
                                                return `${hours}H ${mins}M`
                                            })()
                                        ) : "0H 0M"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-10">
                    {/* FINANCIALS & SERVICES */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Financials & Operations</label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Contract Fee */}
                            <div className="group relative bg-muted/30 border border-border rounded-xl p-4 transition-all hover:bg-muted/50">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 block">Price</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground/50">RON</span>
                                    <Input
                                        type="number"
                                        defaultValue={project.currentFee ? Number(project.currentFee) : ""}
                                        className="h-8 bg-transparent border-none focus-visible:ring-0 shadow-none font-black text-xl pl-12"
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value)
                                            if (project.currentFee && val !== Number(project.currentFee)) {
                                                handleUpdate({ currentFee: val })
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Services List Display */}
                            <div className="group relative bg-muted/30 border border-border rounded-xl p-4 transition-all hover:bg-muted/50 flex flex-col justify-center">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Active Services</label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-2 text-[9px] font-bold uppercase tracking-widest bg-background/50 hover:bg-background border border-border/50 rounded-full text-muted-foreground hover:text-primary transition-all"
                                        onClick={() => setIsEditingServices(!isEditingServices)}
                                    >
                                        {isEditingServices ? "Close Catalog" : "Edit Services"}
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {project.services?.map((s: any) => (
                                        <Badge key={s.id} className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-none">
                                            {s.serviceName}
                                        </Badge>
                                    )) || <span className="text-[10px] text-muted-foreground/40 font-medium italic">No services</span>}
                                </div>
                            </div>
                        </div>

                        {/* Service Catalog Dropdown */}
                        {isEditingServices && (
                            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                <div className="flex justify-between items-center border-b border-border pb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                        Service Catalog
                                    </span>
                                    <div className="px-2 py-0.5 rounded-md bg-primary/5 border border-primary/20 text-[9px] font-bold uppercase tracking-widest text-primary">
                                        {project.services?.[0]?.isRecurring ? "Subscription" : "One-Time"} Mode
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="space-y-2">
                                        <div className="text-[9px] font-bold uppercase text-indigo-600/60 flex items-center gap-2 px-1 tracking-widest">
                                            RECURRING
                                        </div>
                                        <div className="space-y-1">
                                            {allServices.filter(s => s.isRecurring).map(s => {
                                                const isSelected = project.services?.some((ps: any) => ps.id === s.id)
                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => toggleService(s.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all",
                                                            isSelected
                                                                ? "bg-primary/10 border-primary/40 text-primary font-bold"
                                                                : "bg-muted/30 border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <span className="text-[10px] font-medium">{s.serviceName}</span>
                                                        {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-[9px] font-bold uppercase text-emerald-600/60 flex items-center gap-2 px-1 tracking-widest">
                                            ONE-TIME
                                        </div>
                                        <div className="space-y-1">
                                            {allServices.filter(s => !s.isRecurring).map(s => {
                                                const isSelected = project.services?.some((ps: any) => ps.id === s.id)
                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => toggleService(s.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all",
                                                            isSelected
                                                                ? "bg-primary/10 border-primary/40 text-primary font-bold"
                                                                : "bg-muted/30 border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        <span className="text-[10px] font-medium">{s.serviceName}</span>
                                                        {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* TASKS SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tasks</label>
                        </div>
                        <ProjectTasks
                            projectId={project.id}
                            initialTasks={project.tasks || []}
                        />
                    </div>

                    {/* CONTEXT & ASSETS */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Context & Assets</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Link
                                href={`/vault/${project.site.partner.id}`}
                                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group shadow-sm"
                            >
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Partner Entity</div>
                                    <div className="font-semibold text-xs text-foreground/80 group-hover:text-foreground transition-colors">{project.site.partner.name}</div>
                                </div>
                                <FolderOpen className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all" strokeWidth={1.5} />
                            </Link>

                            <Link
                                href={`/vault/${project.site.partner.id}/${project.site.id}`}
                                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group shadow-sm"
                            >
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Domain Asset</div>
                                    <div className="font-semibold text-xs text-foreground/80 tracking-tight group-hover:text-foreground transition-colors">{project.site.domainName}</div>
                                </div>
                                <Globe className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all" strokeWidth={1.5} />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 shadow-sm">
                                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1">GTM Identifier</div>
                                <div className="font-mono text-[10px] font-bold text-muted-foreground/80 bg-muted/50 p-1.5 rounded-lg border border-border text-center overflow-hidden text-ellipsis">{project.site.gtmId || "NOT DEFINED"}</div>
                            </div>
                            <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 shadow-sm">
                                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1">Ads Identifier</div>
                                <div className="font-mono text-[10px] font-bold text-muted-foreground/80 bg-muted/50 p-1.5 rounded-lg border border-border text-center overflow-hidden text-ellipsis">{project.site.googleAdsId || "NOT DEFINED"}</div>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="p-6 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground/60">
                        <div>
                            <span>Created {format(new Date(project.createdAt), "MMM d, yyyy")}</span>
                            {project.updatedAt && (
                                <span className="ml-3 pl-3 border-l border-border/50">
                                    Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                            // onClick={handleDelete}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </TaskSheetWrapper>
    )
}
