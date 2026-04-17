"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Loader2, Plus, Check, ChevronsUpDown, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { addPartnerAdHocPayment, getPartnerProjectsForPayment } from "@/lib/actions/partners"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type AddPartnerPaymentDialogProps = {
    partners: { id: string; name: string }[]
    services: { id: string; name: string }[]
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: ReactNode
    hideTrigger?: boolean
    className?: string
    label?: string
    showLabelOnMobile?: boolean
}

export function AddPartnerPaymentDialog({
    partners,
    services,
    open,
    onOpenChange,
    trigger,
    hideTrigger = false,
    className,
    label = "Add Payment",
    showLabelOnMobile = false,
}: AddPartnerPaymentDialogProps) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [partnerId, setPartnerId] = useState("")
    const [projectId, setProjectId] = useState("")
    const [serviceId, setServiceId] = useState("")
    const [paymentName, setPaymentName] = useState("")
    const [paymentAmount, setPaymentAmount] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [partnerProjects, setPartnerProjects] = useState<Array<{ id: string; name: string; amount: number; paymentStatus: string }>>([])
    const [comboboxOpen, setComboboxOpen] = useState(false)
    const [searchValue, setSearchValue] = useState("")
    const isOpen = open !== undefined ? open : internalOpen
    const setIsOpen = (nextOpen: boolean) => {
        if (open === undefined) {
            setInternalOpen(nextOpen)
        }
        onOpenChange?.(nextOpen)
    }

    useEffect(() => {
        let cancelled = false
        async function loadProjects() {
            if (!partnerId) {
                setPartnerProjects([])
                setProjectId("")
                return
            }
            setIsLoadingProjects(true)
            const result = await getPartnerProjectsForPayment(partnerId)
            if (cancelled) return
            if (result.success && result.data) {
                setPartnerProjects(result.data)
                if (projectId && !result.data.some((project) => project.id === projectId)) {
                    setProjectId("")
                }
            } else {
                setPartnerProjects([])
                toast.error(result.error || "Failed to load projects")
            }
            setIsLoadingProjects(false)
        }

        void loadProjects()
        return () => {
            cancelled = true
        }
    }, [partnerId, projectId])

    const selectedProject = useMemo(
        () => partnerProjects.find((project) => project.id === projectId) || null,
        [partnerProjects, projectId]
    )

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        
        if (!partnerId) {
            toast.error("Please select a partner")
            return
        }

        const trimmedName = paymentName.trim()
        if (!projectId && !trimmedName) {
            toast.error("Please select a project or provide a project name")
            return
        }
        
        const amountNum = parseFloat(paymentAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error("Please provide a valid positive amount")
            return
        }
        if (!serviceId) {
            toast.error("Please select a one-time service")
            return
        }

        setIsSubmitting(true)
        const result = await addPartnerAdHocPayment({
            partnerId,
            projectId: projectId || undefined,
            serviceId,
            name: !projectId ? trimmedName : undefined,
            amount: amountNum,
        })
        setIsSubmitting(false)

        if (result.success) {
            toast.success("Payment added successfully")
            setIsOpen(false)
            setPartnerId("")
            setProjectId("")
            setServiceId("")
            setPartnerProjects([])
            setPaymentName("")
            setPaymentAmount("")
            router.refresh()
        } else {
            toast.error(result.error || "Failed to add payment")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {!hideTrigger ? (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button variant="default" className={cn("header-action-button", className)}>
                            <HandCoins className="h-5 w-5 md:h-4 md:w-4" strokeWidth={2.2} />
                            <span className={showLabelOnMobile ? "inline text-sm font-semibold" : "header-action-label"}>{label}</span>
                        </Button>
                    )}
                </DialogTrigger>
            ) : null}
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Add Payment to Partner</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="partner">Partner</Label>
                        <Select value={partnerId} onValueChange={(val) => { setPartnerId(val); setProjectId(""); setPaymentName(""); }} required>
                            <SelectTrigger id="partner">
                                <SelectValue placeholder="Select a partner" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2 relative flex flex-col">
                        <Label htmlFor="projectInput">Project Name</Label>
                        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    id="projectInput"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={comboboxOpen}
                                    className="w-full justify-between font-normal text-left h-10 px-3 py-2"
                                    disabled={!partnerId || isLoadingProjects}
                                >
                                    <span className="truncate">
                                        {!partnerId
                                            ? "Select a partner first"
                                            : isLoadingProjects
                                            ? "Loading projects..."
                                            : projectId
                                                ? partnerProjects.find((p) => p.id === projectId)?.name
                                                : paymentName || "Select existing project or type new..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInput 
                                        placeholder="Search or type new project..." 
                                        value={searchValue} 
                                        onValueChange={setSearchValue} 
                                    />
                                    <CommandList>
                                        <CommandEmpty className="p-0">
                                            {searchValue.trim() ? (
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-start rounded-none px-4 py-3 text-sm font-normal text-blue-600"
                                                    onClick={() => {
                                                        setProjectId("")
                                                        setPaymentName(searchValue.trim())
                                                        setComboboxOpen(false)
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Create &quot;{searchValue.trim()}&quot;
                                                </Button>
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                                    No projects found.
                                                </div>
                                            )}
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {partnerProjects.map((project) => (
                                                <CommandItem
                                                    key={project.id}
                                                    value={project.name}
                                                    onSelect={() => {
                                                        setProjectId(project.id)
                                                        setPaymentName(project.name)
                                                        setComboboxOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            projectId === project.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {project.name}
                                                </CommandItem>
                                            ))}
                                            {searchValue.trim() && !partnerProjects.some(p => p.name.toLowerCase() === searchValue.trim().toLowerCase()) && (
                                                <Button
                                                    variant="ghost"
                                                    className="w-full justify-start rounded-none px-2 py-1.5 text-sm font-normal text-blue-600"
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        setProjectId("")
                                                        setPaymentName(searchValue.trim())
                                                        setComboboxOpen(false)
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Create &quot;{searchValue.trim()}&quot;
                                                </Button>
                                            )}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        
                        {selectedProject ? (
                            <p className="text-xs text-emerald-600 font-medium mt-1">
                                ✓ Existing project selected. A new paid project entry will be created on the same domain.
                            </p>
                        ) : paymentName.trim() ? (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                                + Will create a new project
                            </p>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="service">One-time Service</Label>
                        <Select value={serviceId} onValueChange={setServiceId} required>
                            <SelectTrigger id="service">
                                <SelectValue placeholder="Select one-time service" />
                            </SelectTrigger>
                            <SelectContent>
                                {services.map((service) => (
                                    <SelectItem key={service.id} value={service.id}>
                                        {service.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {services.length === 0 ? (
                            <p className="text-xs text-amber-600">No one-time services found. Add one in Services first.</p>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (RON)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="e.g. 150"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            required
                        />
                    </div>
                    
                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || services.length === 0 || !serviceId || (!projectId && !paymentName.trim())}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
