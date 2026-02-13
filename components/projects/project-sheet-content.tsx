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
        <div className="flex flex-col h-full bg-background">
            <div className="p-10 pb-8 relative overflow-hidden">
                {/* Subtle mesh highlight */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="space-y-8 relative z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider text-muted-foreground/60">
                            <span className="flex items-center gap-2">PROJ</span>
                            <span className="opacity-40">/</span>
                            <Link href={`/vault/${project.site.partner.id}`} className="hover:text-primary transition-colors">
                                {project.site.partner.name}
                            </Link>
                            <span className="opacity-40">/</span>
                            <span className="text-muted-foreground/60">{project.site.domainName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href={`/projects/${project.id}`} className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 border border-border hover:bg-muted text-muted-foreground transition-all">
                                <Expand className="h-4 w-4" strokeWidth={1.5} />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative group">
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
                                className="input-ghost text-3xl font-bold tracking-tight p-0 h-auto text-foreground placeholder:text-muted-foreground/20"
                                placeholder="Untitled Project"
                            />
                            {updatingId === project.id && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pb-4 border-b border-border">
                            <div className="flex flex-wrap gap-2">
                                {project.services?.map((s: any) => (
                                    <Badge key={s.id} className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md">
                                        {s.serviceName}
                                    </Badge>
                                )) || <span className="text-[11px] text-muted-foreground/60 font-medium italic">No operations assigned</span>}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest bg-muted hover:bg-muted/80 border border-border rounded-full text-muted-foreground hover:text-primary transition-all"
                                onClick={() => setIsEditingServices(!isEditingServices)}
                            >
                                {isEditingServices ? "Hide Catalog" : "Service Catalog"}
                            </Button>
                        </div>
                    </div>

                    {isEditingServices && (
                        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                                    Operational Modules
                                </span>
                                <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[9px] font-bold uppercase tracking-widest text-primary">
                                    {project.services?.[0]?.isRecurring ? "Subscription" : "One-Time"} Mode
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold uppercase text-indigo-600/60 flex items-center gap-2 px-1 tracking-widest">
                                        RECURRING
                                    </div>
                                    <div className="space-y-1.5">
                                        {allServices.filter(s => s.isRecurring).map(s => {
                                            const isSelected = project.services?.some((ps: any) => ps.id === s.id)
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => toggleService(s.id)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all",
                                                        isSelected
                                                            ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-[0_0_20px_rgba(13,148,136,0.08)]"
                                                            : "bg-muted/30 border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <span className="text-[11px] font-medium">{s.serviceName}</span>
                                                    {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold uppercase text-emerald-600/60 flex items-center gap-2 px-1 tracking-widest">
                                        ONE-TIME
                                    </div>
                                    <div className="space-y-1.5">
                                        {allServices.filter(s => !s.isRecurring).map(s => {
                                            const isSelected = project.services?.some((ps: any) => ps.id === s.id)
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => toggleService(s.id)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all",
                                                        isSelected
                                                            ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-[0_0_20px_rgba(13,148,136,0.08)]"
                                                            : "bg-muted/30 border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <span className="text-[11px] font-medium">{s.serviceName}</span>
                                                    {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 pt-0 space-y-12">
                {/* SETTINGS SECTION */}
                <section className="grid grid-cols-2 gap-8 bg-muted/20 p-8 rounded-2xl border border-border shadow-sm">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Lifecycle State</Label>
                        <Select
                            defaultValue={project.status}
                            onValueChange={(val) => handleUpdate({ status: val })}
                        >
                            <SelectTrigger className="h-12 bg-card border-border focus:ring-primary/20 shadow-sm rounded-2xl font-semibold px-4 transition-all hover:bg-muted/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                                <SelectItem value="Active" className="font-medium">Active</SelectItem>
                                <SelectItem value="Paused" className="font-medium text-orange-600">Paused</SelectItem>
                                <SelectItem value="Completed" className="font-medium text-emerald-600">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Ledger State</Label>
                        <Select
                            defaultValue={project.paymentStatus}
                            onValueChange={(val) => handleUpdate({ paymentStatus: val })}
                        >
                            <SelectTrigger className={cn(
                                "h-12 bg-card border-border focus:ring-primary/20 shadow-sm rounded-2xl font-bold px-4 transition-all hover:bg-muted/50",
                                project.paymentStatus === "Paid" ? "text-emerald-600" : "text-rose-600"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                                <SelectItem value="Paid" className="font-bold text-emerald-600">PAID</SelectItem>
                                <SelectItem value="Unpaid" className="font-bold text-rose-600">UNPAID</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3 col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1 flex justify-between px-1">
                            Contract Fee
                            <span className="text-primary/60 font-mono tracking-normal">Current: {project.currentFee} RON</span>
                        </Label>
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground/50">RON</span>
                            <Input
                                type="number"
                                defaultValue={project.currentFee}
                                className="h-14 bg-card border-border focus:border-primary/40 focus:ring-primary/10 shadow-sm pl-14 font-semibold text-xl rounded-2xl transition-all group-hover:bg-muted/30"
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
                <section className="space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                            Service Operations
                        </h3>
                    </div>
                    <ProjectTasks
                        projectId={project.id}
                        initialTasks={project.tasks || []}
                    />
                </section>

                {/* CONTEXT SECTION */}
                <section className="space-y-8 pt-8 border-t border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                            <Target className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                            Context & Assets
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link
                            href={`/vault/${project.site.partner.id}`}
                            className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group shadow-sm"
                        >
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Partner Entity</div>
                                <div className="font-semibold text-[13px] text-foreground/80 group-hover:text-foreground transition-colors">{project.site.partner.name}</div>
                            </div>
                            <FolderOpen className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all" strokeWidth={1.5} />
                        </Link>

                        <Link
                            href={`/vault/${project.site.partner.id}/${project.site.id}`}
                            className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group shadow-sm"
                        >
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Domain Asset</div>
                                <div className="font-semibold text-[13px] text-foreground/80 tracking-tight group-hover:text-foreground transition-colors">{project.site.domainName}</div>
                            </div>
                            <Globe className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all" strokeWidth={1.5} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-2 shadow-sm">
                            <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1">GTM Identifier</div>
                            <div className="font-mono text-[11px] font-bold text-muted-foreground/80 bg-muted/50 p-2 rounded-lg border border-border text-center">{project.site.gtmId || "NOT DEFINED"}</div>
                        </div>
                        <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-2 shadow-sm">
                            <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1">Ads Identifier</div>
                            <div className="font-mono text-[11px] font-bold text-muted-foreground/80 bg-muted/50 p-2 rounded-lg border border-border text-center">{project.site.googleAdsId || "NOT DEFINED"}</div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="p-8 border-t border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground/60 border border-border">
                        <Calendar className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Created on</div>
                        <div className="text-[13px] font-semibold text-foreground/70">{format(new Date(project.createdAt), "MMMM do, yyyy")}</div>
                    </div>
                </div>
                <div className="text-[10px] font-medium text-muted-foreground/40 italic">
                    Edited {formatDistanceToNow(new Date(project.updatedAt))} ago
                </div>
            </div>
        </div>
    )
}
