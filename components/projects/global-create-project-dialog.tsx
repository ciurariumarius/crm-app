"use client"

import { useState, useMemo, useEffect } from "react"
import { createProject } from "@/lib/actions/projects"
import { createSite } from "@/lib/actions/sites"
import { searchProjectServices } from "@/lib/actions/services"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { toast } from "sonner"
import { Check, X, SlidersHorizontal, ChevronDown, ChevronUp, Repeat, Clock3, Loader2, ChevronsUpDown, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Service } from "@prisma/client"
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
    const [projectStatus, setProjectStatus] = useState<"Active" | "Paused" | "Completed" | "Closed">("Active")
    const [isPaid, setIsPaid] = useState(false)
    const [showDetails, setShowDetails] = useState(false)
    const [fee, setFee] = useState("")
    const [serviceQuery, setServiceQuery] = useState("")
    const [ajaxServices, setAjaxServices] = useState<Array<Pick<Service, "id" | "serviceName" | "isRecurring" | "baseFee">>>([])
    const [isSearchingServices, setIsSearchingServices] = useState(false)
    const [siteComboboxOpen, setSiteComboboxOpen] = useState(false)
    const [siteQuery, setSiteQuery] = useState("")

    const [addingSite, setAddingSite] = useState(false)

    // Sync with props if they change
    useEffect(() => {
        if (defaultPartnerId) setPartnerId(defaultPartnerId)
        if (defaultSiteId) setSiteId(defaultSiteId)
    }, [defaultPartnerId, defaultSiteId])

    const allSites = useMemo(() =>
        partners.flatMap((partner) =>
            (partner.sites || []).map((site) => ({
                id: site.id,
                domainName: site.domainName,
                partnerId: partner.id,
                partnerName: partner.name,
            }))
        ),
        [partners])

    const availableSites = useMemo(() => {
        if (defaultPartnerId) {
            return allSites.filter((site) => site.partnerId === defaultPartnerId)
        }
        if (partnerId) {
            return allSites.filter((site) => site.partnerId === partnerId)
        }
        return allSites
    }, [allSites, defaultPartnerId, partnerId])

    const normalizedSiteQuery = siteQuery.trim().toLowerCase()
    const hasSiteQuery = normalizedSiteQuery.length > 0
    const suggestedSiteDomain = useMemo(() => {
        if (!hasSiteQuery) return ""
        const normalized = normalizedSiteQuery
            .replace(/^https?:\/\//, "")
            .replace(/\s+/g, "")
        if (!normalized) return ""
        return normalized.includes(".") ? normalized : `${normalized}.ro`
    }, [hasSiteQuery, normalizedSiteQuery])
    const siteAlreadyExists = useMemo(
        () =>
            availableSites.some(
                (site) => site.domainName.trim().toLowerCase() === suggestedSiteDomain
            ),
        [availableSites, suggestedSiteDomain]
    )

    const selectedServices = useMemo(() =>
        services.filter(s => selectedServiceIds.includes(s.id)),
        [services, selectedServiceIds])
    const resolvedPartnerId = partnerId || defaultPartnerId || ""

    // Determine the "kind" allowed based on the first selected service
    const allowedKind = selectedServices.length > 0 ? selectedServices[0].isRecurring : null

    const availableServices = useMemo(() => {
        if (allowedKind === null) return services
        return services.filter(s => s.isRecurring === allowedKind)
    }, [services, allowedKind])

    const filteredServices = useMemo(() => {
        const query = serviceQuery.trim().toLowerCase()
        if (!query) return availableServices
        return availableServices.filter((service) =>
            service.serviceName.toLowerCase().includes(query)
        )
    }, [availableServices, serviceQuery])

    const servicesToRender = useMemo(() => {
        const query = serviceQuery.trim()
        if (!query) return filteredServices
        return ajaxServices
    }, [serviceQuery, filteredServices, ajaxServices])

    useEffect(() => {
        const query = serviceQuery.trim()
        if (!query || !open) {
            setAjaxServices([])
            setIsSearchingServices(false)
            return
        }

        let cancelled = false
        const timer = setTimeout(async () => {
            setIsSearchingServices(true)
            try {
                const cadence = allowedKind === null ? "all" : allowedKind ? "recurring" : "one-time"
                const results = await searchProjectServices(query, cadence)
                if (!cancelled) {
                    setAjaxServices(results)
                }
            } catch {
                if (!cancelled) {
                    setAjaxServices([])
                }
            } finally {
                if (!cancelled) {
                    setIsSearchingServices(false)
                }
            }
        }, 250)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [serviceQuery, allowedKind, open])

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
        if (siteId) {
            const currentSite = allSites.find((site) => site.id === siteId)
            if (currentSite && currentSite.partnerId !== id) {
                setSiteId("")
            }
        }
        setSiteQuery("")
    }

    const handleSiteChange = (id: string) => {
        setSiteId(id)
        setSiteComboboxOpen(false)
        setSiteQuery("")
        if (defaultPartnerId) return

        const selectedSite = allSites.find((site) => site.id === id)
        if (selectedSite) {
            setPartnerId(selectedSite.partnerId)
        }
    }

    const handleQuickAddSite = async (rawDomain: string) => {
        const domain = rawDomain.trim()
        if (!domain || !resolvedPartnerId) return
        setAddingSite(true)
        try {
            const result = await createSite(resolvedPartnerId, domain)
            if (!result.success) {
                toast.error(result.error)
                return
            }
            if (result.warning) toast.warning(result.warning.message)
            else toast.success("Site added successfully")
            setSiteId(result.site.id)
            setSiteComboboxOpen(false)
            setSiteQuery("")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add site")
        } finally {
            setAddingSite(false)
        }
    }

    const toggleService = (id: string) => {
        if (selectedServiceIds.includes(id)) {
            setSelectedServiceIds(prev => prev.filter(sid => sid !== id))
        } else {
            const serviceToAdd = services.find(s => s.id === id) || ajaxServices.find(s => s.id === id)
            if (!serviceToAdd) return

            // If it's the first service, just add it
            if (selectedServiceIds.length === 0) {
                setSelectedServiceIds([id])
            } else {
                // Check if same kind
                if (serviceToAdd.isRecurring === allowedKind) {
                    setSelectedServiceIds(prev => [...prev, id])
                } else {
                    toast.error("You can only combine services with compatible billing cadence.")
                }
            }
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
                status: showDetails ? projectStatus : undefined,
                paymentStatus: showDetails ? (isPaid ? "Paid" : "Unpaid") : undefined,
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
        setSelectedServiceIds([])
        setFee("")
        setProjectStatus("Active")
        setIsPaid(false)
        setShowDetails(false)
        setServiceQuery("")
        setSiteComboboxOpen(false)
        setSiteQuery("")
        setAjaxServices([])
        setIsSearchingServices(false)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="w-[96vw] sm:max-w-[860px] p-0 overflow-hidden border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-2xl flex flex-col max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/10">
                        <DialogHeader className="p-7 pb-5 border-b border-[var(--line-subtle)]">
                            <DialogTitle className="text-[40px] leading-none font-semibold tracking-tight">
                                Add New Project
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-7 space-y-6">
                        {/* 1. Partner Selection */}
                        {!defaultPartnerId && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    01. Target Partner
                                </Label>
                                <Select value={partnerId} onValueChange={handlePartnerChange}>
                                    <SelectTrigger className="h-12 rounded-xl bg-[var(--surface-lowest)] border border-[var(--line-subtle)] shadow-none focus:ring-1 focus:ring-primary/20 px-4">
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
                        {!defaultSiteId && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                        02. Target Site
                                    </Label>
                                </div>

                                <Popover open={siteComboboxOpen} onOpenChange={setSiteComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={siteComboboxOpen}
                                            className="w-full justify-between h-12 rounded-xl bg-[var(--surface-lowest)] border border-[var(--line-subtle)] shadow-none hover:bg-[var(--surface-lowest)] px-4 font-semibold text-[var(--text-primary)]"
                                        >
                                            <span className="truncate text-left">
                                                {siteId
                                                    ? (() => {
                                                        const site = allSites.find((item) => item.id === siteId)
                                                        if (!site) return "Select a site..."
                                                        return !partnerId && !defaultPartnerId
                                                            ? `${site.domainName} - ${site.partnerName}`
                                                            : site.domainName
                                                    })()
                                                    : "Select a site..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Search site or type new domain..."
                                                value={siteQuery}
                                                onValueChange={setSiteQuery}
                                            />
                                            <CommandList className="max-h-[260px]">
                                                <CommandEmpty>
                                                    {resolvedPartnerId
                                                        ? "No sites found."
                                                        : "No sites found. Choose a partner to add a site."}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {availableSites.map((s) => (
                                                        <CommandItem
                                                            key={s.id}
                                                            value={`${s.domainName} ${s.partnerName}`}
                                                            onSelect={() => handleSiteChange(s.id)}
                                                            className="py-2.5"
                                                        >
                                                            <div className="flex min-w-0 flex-col">
                                                                <span className="truncate font-medium text-[var(--text-primary)]">
                                                                    {s.domainName}
                                                                </span>
                                                                {!partnerId && !defaultPartnerId && (
                                                                    <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
                                                                        {s.partnerName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {siteId === s.id && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                        </CommandItem>
                                                    ))}
                                                    {hasSiteQuery && (
                                                        <div className="px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border-t border-[var(--line-subtle)]">
                                                            {suggestedSiteDomain}
                                                        </div>
                                                    )}
                                                    {resolvedPartnerId && hasSiteQuery && !siteAlreadyExists && (
                                                        <CommandItem
                                                            value={`add-site-${suggestedSiteDomain}`}
                                                            onSelect={() => {
                                                                void handleQuickAddSite(suggestedSiteDomain)
                                                            }}
                                                            disabled={addingSite}
                                                            className="py-2.5"
                                                        >
                                                            {addingSite ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Plus className="mr-2 h-4 w-4 text-primary" />
                                                            )}
                                                            <span className="truncate font-semibold text-primary">
                                                                Add site &quot;{suggestedSiteDomain}&quot;
                                                            </span>
                                                        </CommandItem>
                                                    )}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* 3. Service Selection (Multi) */}
                        <div className="space-y-4 pt-4 border-t border-dashed">
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    03. Services
                                </Label>

                                {selectedServices.length > 0 && (
                                    <div className="flex flex-wrap gap-2 p-2 bg-[var(--surface-low)] rounded-xl border border-[var(--line-subtle)]">
                                        {selectedServices.map(s => (
                                            <Badge key={s.id} variant="secondary" className="pl-2 pr-1 h-7 gap-1 font-bold bg-[var(--surface-lowest)] shadow-sm border-[var(--line-subtle)] text-[var(--text-secondary)]">
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
                                    </div>
                                )}

                                <Input
                                    placeholder="Select one or more services..."
                                    value={serviceQuery}
                                    onChange={(e) => setServiceQuery(e.target.value)}
                                    className="h-12 rounded-xl bg-[var(--surface-lowest)] border border-[var(--line-subtle)] shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                />

                                <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[160px] pr-2 scrollbar-thin scrollbar-thumb-primary/10">
                                    {isSearchingServices && (
                                        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-dashed border-muted p-3 text-xs text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Searching services...
                                        </div>
                                    )}
                                    {servicesToRender.map((s) => {
                                        const isSelected = selectedServiceIds.includes(s.id)
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => toggleService(s.id)}
                                                className={cn(
                                                    "flex flex-col items-start p-4 text-left rounded-xl border transition-colors relative overflow-hidden",
                                                    isSelected
                                                        ? "bg-primary/5 border-primary"
                                                        : "bg-[var(--surface-lowest)] border-[var(--line-subtle)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                                )}
                                            >
                                                <div className="flex items-center justify-between w-full gap-2">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {s.isRecurring ? (
                                                            <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        ) : (
                                                            <Clock3 className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
                                                        )}
                                                        <span className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "text-foreground")}>
                                                            {s.serviceName}
                                                        </span>
                                                    </div>
                                                    <span className={cn(
                                                        "h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                                                        isSelected ? "bg-primary border-primary text-white" : "bg-[var(--surface-lowest)] border-[var(--line-subtle)] text-transparent"
                                                    )}>
                                                        <Check className="h-3 w-3" />
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                    {!isSearchingServices && servicesToRender.length === 0 && (
                                        <div className="col-span-2 rounded-xl border border-dashed border-muted p-3 text-xs text-muted-foreground">
                                            No services match your search.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-dashed">
                                <div className="space-y-2">
                                    <Label htmlFor="fee" className="text-xs font-semibold text-muted-foreground/70">Total Fee</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">RON</span>
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

                                <div className="pt-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="w-full flex justify-between items-center h-12 bg-muted/10 hover:bg-muted/30 text-muted-foreground font-medium rounded-xl border border-dashed border-border"
                                    >
                                        <span className="flex items-center gap-2 text-sm">
                                            <SlidersHorizontal className="w-4 h-4" />
                                            Add Additional Details
                                        </span>
                                        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </Button>
                                </div>

                                {showDetails && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)] p-1">
                                            <div className="grid grid-cols-4 gap-1">
                                                {(["Active", "Paused", "Completed", "Closed"] as const).map((statusOption) => (
                                                    <button
                                                        key={statusOption}
                                                        type="button"
                                                        onClick={() => setProjectStatus(statusOption)}
                                                        className={cn(
                                                            "h-8 rounded-lg px-2 text-xs font-bold transition-all border border-transparent",
                                                            projectStatus === statusOption && statusOption === "Active" && "status-pill-action shadow-sm",
                                                            projectStatus === statusOption && statusOption === "Paused" && "status-pill-warning shadow-sm",
                                                            projectStatus === statusOption && statusOption === "Completed" && "status-pill-success shadow-sm",
                                                            projectStatus === statusOption && statusOption === "Closed" && "status-pill-closed shadow-sm",
                                                            projectStatus !== statusOption && "text-[var(--text-secondary)] hover:bg-[var(--surface-lowest)]/80 hover:text-[var(--text-secondary)]"
                                                        )}
                                                    >
                                                        {statusOption}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setIsPaid(!isPaid)}
                                            className={cn(
                                                "flex items-center justify-between p-3.5 rounded-xl border transition-all premium-card",
                                                isPaid
                                                    ? "status-pill-action/10 border-blue-500/30 text-blue-600"
                                                    : "bg-muted/20 border-transparent text-muted-foreground hover:border-primary/20"
                                            )}
                                        >
                                            <Label className="text-xs font-semibold cursor-pointer">
                                                Mark as Paid
                                            </Label>
                                            <div className={cn(
                                                "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                                                isPaid ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/30 bg-background"
                                            )}>
                                                {isPaid && <Check className="h-3 w-3" />}
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/5 border-t">
                        <Button
                            type="submit"
                            disabled={loading || !siteId || selectedServiceIds.length === 0}
                            className="w-full h-14 text-sm font-semibold uppercase shadow-xl shadow-primary/20 rounded-xl"
                        >
                            {loading ? "Initializing..." : (
                                <span className="flex items-center justify-center gap-2">
                                    Add New Project <Check className="h-4 w-4" />
                                </span>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
