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
    Target,
    FolderOpen,
    Check,
    X,
    Loader2,
    AlertCircle,
    Expand
} from "lucide-react"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateProject } from "@/lib/actions"
import { toast } from "sonner"

import { getProjectDisplayName } from "@/lib/project-utils"

interface ProjectSheetContentProps {
    project: any
    allServices: any[]
    onUpdate?: (updatedProject: any) => void
    onOpenSite?: (site: any) => void
}

export function ProjectSheetContent({ project: initialProject, allServices, onUpdate, onOpenSite }: ProjectSheetContentProps) {
    const [project, setProject] = React.useState(initialProject)
    const [localName, setLocalName] = React.useState("")
    const [isEditingServices, setIsEditingServices] = React.useState(false)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)

    // Sync state when prop changes
    React.useEffect(() => {
        setProject(initialProject)
    }, [initialProject])

    // Sync localName
    React.useEffect(() => {
        if (project) {
            setLocalName(project.name || getProjectDisplayName(project))
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
        <>
            <div className="p-8 border-b bg-muted/20 relative">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            <Link href={`/vault/${project.site.partner.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                <Users className="h-3 w-3" />
                                {project.site.partner.name}
                            </Link>
                            <span className="opacity-30">/</span>
                            <div
                                onClick={() => onOpenSite ? onOpenSite(project.site) : window.location.href = `/vault/${project.site.partner.id}/${project.site.id}`}
                                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                            >
                                <Globe className="h-3 w-3" />
                                {project.site.domainName}
                            </div>
                        </div>
                        <Link href={`/projects/${project.id}`} className="opacity-50 hover:opacity-100 hover:text-primary transition-all">
                            <Expand className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="group relative">
                        <div className="space-y-2">
                            <div className="relative">
                                <Input
                                    value={localName}
                                    onChange={(e) => setLocalName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && localName !== (project.name || getProjectDisplayName(project))) {
                                            handleUpdate({ name: localName })
                                        }
                                        if (e.key === 'Escape') {
                                            setLocalName(project.name || getProjectDisplayName(project))
                                        }
                                    }}
                                    className="text-5xl font-black italic tracking-tighter border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto pr-24"
                                    placeholder="Project Nickname"
                                />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {updatingId === project.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    ) : (
                                        localName !== (project.name || getProjectDisplayName(project)) && (
                                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                    onClick={() => handleUpdate({ name: localName })}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                                    onClick={() => setLocalName(project.name || getProjectDisplayName(project))}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                            {localName !== (project.name || getProjectDisplayName(project)) && (
                                <div className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                    Unsaved Changes
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            {project.services?.map((s: any) => (
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
                                    Active Project Type: {project.services?.[0]?.isRecurring ? "Recurring" : "One-time"}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                                <div className="space-y-2">
                                    <div className="text-[9px] font-black uppercase text-rose-500/60 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Recurring
                                    </div>
                                    {allServices.filter(s => s.isRecurring).map(s => {
                                        const isSelected = project.services?.some((ps: any) => ps.id === s.id)
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
                                        const isSelected = project.services?.some((ps: any) => ps.id === s.id)
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
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-12 text-sm">
                {/* EDITABLE CONTROLS SECTION */}
                <section className="grid grid-cols-2 gap-6 bg-muted/20 p-6 rounded-2xl border border-dashed">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lifecycle Status</Label>
                        <Select
                            defaultValue={project.status}
                            onValueChange={(val) => handleUpdate({ status: val })}
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
                            defaultValue={project.paymentStatus}
                            onValueChange={(val) => handleUpdate({ paymentStatus: val })}
                        >
                            <SelectTrigger className={cn(
                                "h-11 bg-background border-none shadow-sm font-black italic",
                                project.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"
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
                            <span className="text-primary/40 font-mono">Current: {project.currentFee}</span>
                        </Label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40">RON</span>
                            <Input
                                type="number"
                                defaultValue={project.currentFee}
                                className="h-11 bg-background border-none shadow-sm pl-12 font-black italic text-lg"
                                onBlur={(e) => {
                                    const val = parseFloat(e.target.value)
                                    if (val !== project.currentFee) {
                                        handleUpdate({ currentFee: val })
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
                        projectId={project.id}
                        initialTasks={project.tasks || []}
                    />
                </section>

                {/* SITE CONTEXT SECTION */}
                <section className="space-y-6 pt-6 border-t border-dashed">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" /> Context & Technicals
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <Link
                            href={`/vault/${project.site.partner.id}`}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all group"
                        >
                            <div className="space-y-0.5">
                                <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Partner Entity</div>
                                <div className="font-bold text-sm group-hover:text-primary transition-colors">{project.site.partner.name}</div>
                            </div>
                            <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>

                        <Link
                            href={`/vault/${project.site.partner.id}/${project.site.id}`}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-transparent hover:border-primary/20 transition-all group"
                        >
                            <div className="space-y-0.5">
                                <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Domain Asset</div>
                                <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{project.site.domainName}</div>
                            </div>
                            <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                            <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">GTM ID</div>
                            <div className="font-mono text-xs font-bold text-muted-foreground">{project.site.gtmId || "UNSET"}</div>
                        </div>
                        <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                            <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">ADS ID</div>
                            <div className="font-mono text-xs font-bold text-muted-foreground">{project.site.googleAdsId || "UNSET"}</div>
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
                        <div className="text-sm font-bold">{format(new Date(project.createdAt), "MMMM do, yyyy")}</div>
                    </div>
                </div>
                <div className="text-[10px] font-mono font-medium text-muted-foreground opacity-40 italic">
                    Last edit {formatDistanceToNow(new Date(project.updatedAt))} ago
                </div>
            </div>
        </>
    )
}
