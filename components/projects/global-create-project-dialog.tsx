"use client"

import { useState, useMemo, useEffect } from "react"
import { createProject } from "@/lib/actions/projects"
import { createSite } from "@/lib/actions/sites"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Plus, Globe, Users, Briefcase, Sparkles, Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Partner, Service } from "@prisma/client"
import { PartnerWithSites } from "@/types"

interface GlobalCreateProjectDialogProps {
    partners: PartnerWithSites[]
    services: Service[]
    defaultPartnerId?: string
    defaultSiteId?: string
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function GlobalCreateProjectDialog({
    partners,
    services,
    defaultPartnerId,
    defaultSiteId,
    trigger,
    open: externalOpen,
    onOpenChange: externalOnOpenChange
}: GlobalCreateProjectDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Use external state if provided, otherwise use internal
    const open = externalOpen !== undefined ? externalOpen : internalOpen
    const setOpen = externalOnOpenChange || setInternalOpen

    const [partnerId, setPartnerId] = useState(defaultPartnerId || "")
    const [siteId, setSiteId] = useState(defaultSiteId || "")
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
    const [isCompleted, setIsCompleted] = useState(false)
    const [isPaid, setIsPaid] = useState(false)
    const [fee, setFee] = useState("")

    // Quick Add Site state
    const [showQuickAddSite, setShowQuickAddSite] = useState(false)
    const [newSiteDomain, setNewSiteDomain] = useState("")
    const [addingSite, setAddingSite] = useState(false)

    // Sync with props if they change
    useEffect(() => {
        if (defaultPartnerId) setPartnerId(defaultPartnerId)
        if (defaultSiteId) setSiteId(defaultSiteId)
    }, [defaultPartnerId, defaultSiteId])

    const selectedPartner = useMemo(() =>
        partners.find(p => p.id === partnerId),
        [partners, partnerId])

    const selectedServices = useMemo(() =>
        services.filter(s => selectedServiceIds.includes(s.id)),
        [services, selectedServiceIds])

    // Determine the "kind" allowed based on the first selected service
    const allowedKind = selectedServices.length > 0 ? selectedServices[0].isRecurring : null

    const availableServices = useMemo(() => {
        if (allowedKind === null) return services
        return services.filter(s => s.isRecurring === allowedKind)
    }, [services, allowedKind])

    // Auto-calculate sum of base fees when services change
    useEffect(() => {
        if (selectedServices.length > 0) {
            const total = selectedServices.reduce((sum, s) => {
                const bFee = parseFloat(s.baseFee?.toString() || "0")
                return sum + bFee
            }, 0)
            setFee(total > 0 ? total.toString() : "")
        } else {
            setFee("")
        }
    }, [selectedServices])

    const handlePartnerChange = (id: string) => {
        setPartnerId(id)
        setSiteId("")
        setShowQuickAddSite(false)
    }

    const toggleService = (id: string) => {
        if (selectedServiceIds.includes(id)) {
            setSelectedServiceIds(prev => prev.filter(sid => sid !== id))
        } else {
            const serviceToAdd = services.find(s => s.id === id)
            if (!serviceToAdd) return

            // If it's the first service, just add it
            if (selectedServiceIds.length === 0) {
                setSelectedServiceIds([id])
            } else {
                // Check if same kind
                if (serviceToAdd.isRecurring === allowedKind) {
                    setSelectedServiceIds(prev => [...prev, id])
                } else {
                    toast.error(`You can only select multiple ${allowedKind ? 'recurring' : 'one-time'} services at once.`)
                }
            }
        }
    }

    const handleQuickAddSite = async () => {
        if (!newSiteDomain || !partnerId) return
        setAddingSite(true)
        try {
            const newSite = await createSite(partnerId, newSiteDomain)
            toast.success("Site added successfully")
            setSiteId(newSite.id)
            setShowQuickAddSite(false)
            setNewSiteDomain("")
        } catch (e) {
            toast.error("Failed to add site")
        } finally {
            setAddingSite(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!siteId || selectedServiceIds.length === 0) {
            toast.error("Please complete the selection.")
            return
        }

        setLoading(true)
        try {
            await createProject({
                siteId,
                serviceIds: selectedServiceIds,
                currentFee: fee ? parseFloat(fee) : undefined,
                status: isCompleted ? "Completed" : "Active",
                paymentStatus: isPaid ? "Paid" : "Unpaid",
            })

            setOpen(false)
            resetForm()
            toast.success("Project template initialized!")
        } catch (error) {
            console.error(error)
            toast.error("Failed to create project")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        if (!defaultPartnerId) setPartnerId("")
        if (!defaultSiteId) setSiteId("")
        if (!defaultSiteId) setSiteId("")
        setSelectedServiceIds([])
        setFee("")
        setIsCompleted(false)
        setIsPaid(false)
        setShowQuickAddSite(false)
        setNewSiteDomain("")
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="w-[95vw] sm:max-w-[650px] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-8 pb-5 border-b">
                        <DialogTitle className="text-2xl flex items-center gap-3 font-bold tracking-tight">
                            <Sparkles className="h-6 w-6 text-primary" />
                            ADD NEW PROJECT
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                            Bundle services into a single project template.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-primary/10">
                        {/* 1. Partner Selection */}
                        {!defaultPartnerId && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                    01. Target Partner
                                </Label>
                                <Select value={partnerId} onValueChange={handlePartnerChange}>
                                    <SelectTrigger className="h-11 bg-muted/30 border-none shadow-none focus:ring-1">
                                        <SelectValue placeholder="Choose a partner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partners.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* 2. Site Selection */}
                        {(partnerId || defaultPartnerId) && !defaultSiteId && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center">
                                    <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                        02. Target Site
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-auto p-0 text-[10px] font-black uppercase tracking-tighter text-primary/60 hover:text-primary"
                                        onClick={() => setShowQuickAddSite(!showQuickAddSite)}
                                    >
                                        {showQuickAddSite ? "Back to list" : "+ Add site"}
                                    </Button>
                                </div>

                                {showQuickAddSite ? (
                                    <div className="flex gap-2 p-2 bg-primary/5 rounded-xl border border-dashed border-primary/20">
                                        <div className="relative flex-1">
                                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="e.g. domain.com"
                                                className="pl-8 h-9 text-sm bg-transparent border-none focus-visible:ring-0"
                                                value={newSiteDomain}
                                                onChange={(e) => setNewSiteDomain(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 px-4 rounded-lg font-bold"
                                            disabled={addingSite || !newSiteDomain}
                                            onClick={handleQuickAddSite}
                                        >
                                            {addingSite ? "..." : "ADD"}
                                        </Button>
                                    </div>
                                ) : (
                                    <Select value={siteId} onValueChange={setSiteId}>
                                        <SelectTrigger className="h-11 bg-muted/30 border-none shadow-none focus:ring-1">
                                            <SelectValue placeholder="Select site..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedPartner?.sites.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>{s.domainName}</SelectItem>
                                            ))}
                                            {(!selectedPartner?.sites || selectedPartner.sites.length === 0) && (
                                                <div className="p-4 text-center space-y-2">
                                                    <p className="text-xs text-muted-foreground">No sites found for this partner.</p>
                                                    <Button variant="link" size="sm" onClick={() => setShowQuickAddSite(true)}>Add one now</Button>
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}

                        {/* 2.5 Removed Nickname per request */}

                        {/* 3. Service Selection (Multi) */}
                        {(siteId || defaultSiteId) && (
                            <div className="space-y-4 pt-4 border-t border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                                        03. Service Bundle {allowedKind !== null && `(${allowedKind ? 'Recurring' : 'One-time'})`}
                                    </Label>

                                    <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-muted/20 rounded-xl border">
                                        {selectedServices.map(s => (
                                            <Badge key={s.id} variant="secondary" className="pl-2 pr-1 h-7 gap-1 font-bold bg-background shadow-sm border-primary/10">
                                                {s.serviceName}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleService(s.id)}
                                                    className="hover:bg-muted p-0.5 rounded-full"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                        {selectedServiceIds.length === 0 && (
                                            <span className="text-xs text-muted-foreground self-center px-1">Select one or more services...</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[160px] pr-2 scrollbar-thin scrollbar-thumb-primary/10">
                                        {availableServices.map((s) => {
                                            const isSelected = selectedServiceIds.includes(s.id)
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => toggleService(s.id)}
                                                    className={cn(
                                                        "flex flex-col items-start p-3 text-left rounded-xl border transition-all group relative overflow-hidden",
                                                        isSelected
                                                            ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                                                            : "bg-background hover:bg-muted/50 border-muted hover:border-primary/20"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between w-full mb-1">
                                                        <span className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "text-foreground")}>
                                                            {s.serviceName}
                                                        </span>
                                                        {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                                                    </div>
                                                    <span className="text-[10px] font-mono text-muted-foreground/70">
                                                        {parseFloat(s.baseFee?.toString() || "0")} RON
                                                    </span>
                                                    {isSelected && (
                                                        <div className="absolute bottom-0 right-0 h-1 w-full bg-primary" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {selectedServiceIds.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-dashed animate-in zoom-in-95 duration-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="fee" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Total Fee (RON)</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-black">RON</span>
                                                    <Input
                                                        id="fee"
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        className="pl-12 h-11 bg-primary/5 border-none font-bold"
                                                        value={fee}
                                                        onChange={(e) => setFee(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 text-right block">Type</Label>
                                                <div className="h-11 flex items-center justify-end px-4 bg-muted/20 rounded-xl text-xs font-black uppercase tracking-tighter text-primary">
                                                    {allowedKind ? "RECURRING" : "ONE-TIME"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsCompleted(!isCompleted)}
                                                className={cn(
                                                    "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                                                    isCompleted
                                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                                                        : "bg-muted/20 border-transparent text-muted-foreground hover:border-primary/20"
                                                )}
                                            >
                                                <Label className="text-[10px] font-black uppercase tracking-widest cursor-pointer">
                                                    Mark as COMPLETED
                                                </Label>
                                                <div className={cn(
                                                    "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                                                    isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 bg-background"
                                                )}>
                                                    {isCompleted && <Check className="h-3 w-3" />}
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setIsPaid(!isPaid)}
                                                className={cn(
                                                    "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                                                    isPaid
                                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-600"
                                                        : "bg-muted/20 border-transparent text-muted-foreground hover:border-primary/20"
                                                )}
                                            >
                                                <Label className="text-[10px] font-black uppercase tracking-widest cursor-pointer">
                                                    Mark as PAID
                                                </Label>
                                                <div className={cn(
                                                    "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                                                    isPaid ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/30 bg-background"
                                                )}>
                                                    {isPaid && <Check className="h-3 w-3" />}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-8 bg-muted/5 border-t">
                        <Button
                            type="submit"
                            disabled={loading || !siteId || selectedServiceIds.length === 0}
                            className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 rounded-xl"
                        >
                            {loading ? "INITIALIZING..." : (
                                <span className="flex items-center gap-2">
                                    ADD NEW PROJECT <Check className="h-5 w-5" />
                                </span>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
