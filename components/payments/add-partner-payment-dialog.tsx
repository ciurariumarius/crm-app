"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ChevronsUpDown, HandCoins, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { addPartnerAdHocPayment, getPartnerProjectsForPayment } from "@/lib/actions/partners"
import { setProjectPaymentState } from "@/lib/actions/projects"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { mergePaymentMethods, normalizePaymentMethod } from "@/lib/payments/methods"

type PaymentMode = "existing" | "new"
type ProjectOption = { id: string; name: string; amount: number; paymentStatus: string }

type AddPartnerPaymentDialogProps = {
    partners: { id: string; name: string }[]
    services: { id: string; name: string }[]
    paymentMethods?: string[]
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: ReactNode
    hideTrigger?: boolean
    className?: string
    label?: string
    showLabelOnMobile?: boolean
}

export function AddPartnerPaymentDialog({ partners, services, paymentMethods = [], open, onOpenChange, trigger, hideTrigger = false, className, label = "Add Payment", showLabelOnMobile = false }: AddPartnerPaymentDialogProps) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [mode, setMode] = useState<PaymentMode>("existing")
    const [partnerId, setPartnerId] = useState("")
    const [projectId, setProjectId] = useState("")
    const [serviceId, setServiceId] = useState("")
    const [paymentName, setPaymentName] = useState("")
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentDescription, setPaymentDescription] = useState("")
    const [paymentMethod, setPaymentMethod] = useState("Revolut")
    const [customPaymentMethod, setCustomPaymentMethod] = useState("")
    const [projects, setProjects] = useState<ProjectOption[]>([])
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const isOpen = open !== undefined ? open : internalOpen

    const reset = () => {
        setMode("existing"); setPartnerId(""); setProjectId(""); setServiceId(""); setPaymentName("")
        setPaymentAmount(""); setPaymentDescription(""); setPaymentMethod("Revolut"); setCustomPaymentMethod(""); setProjects([]); setErrors({})
    }
    const setIsOpen = (nextOpen: boolean) => {
        if (open === undefined) setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
        if (!nextOpen) reset()
    }

    useEffect(() => {
        let cancelled = false
        if (!partnerId || mode !== "existing") return
        void getPartnerProjectsForPayment(partnerId).then((result) => {
            if (cancelled) return
            if (result.success && result.data) setProjects(result.data.filter((project) => project.paymentStatus === "Unpaid"))
            else { setProjects([]); toast.error(result.error || "Failed to load projects") }
            setIsLoadingProjects(false)
        })
        return () => { cancelled = true }
    }, [mode, partnerId])

    const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) || null, [projectId, projects])
    const changeMode = (nextMode: PaymentMode) => {
        setMode(nextMode); setProjects([]); setProjectId(""); setPaymentName(""); setPaymentAmount(""); setPaymentDescription(""); setErrors({})
        if (nextMode === "existing" && partnerId) setIsLoadingProjects(true)
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        const amount = Number(paymentAmount.replace(",", "."))
        const resolvedPaymentMethod = paymentMethod === "__custom__"
            ? normalizePaymentMethod(customPaymentMethod)
            : normalizePaymentMethod(paymentMethod)
        const nextErrors: Record<string, string> = {}
        if (!partnerId) nextErrors.partner = "Choose a partner"
        if (mode === "existing" && !projectId) nextErrors.project = "Choose an unpaid project"
        if (mode === "new" && !paymentName.trim()) nextErrors.name = "Enter a payment name"
        if (mode === "new" && !serviceId) nextErrors.service = "Choose a one-time service"
        if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = "Enter a positive amount"
        if (!resolvedPaymentMethod) nextErrors.paymentMethod = "Choose or add a payment method"
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length) return

        setIsSubmitting(true)
        const result = mode === "existing"
            ? await setProjectPaymentState({ projectId, expectedStatus: "Unpaid", nextStatus: "Paid", amount, paymentMethod: resolvedPaymentMethod })
            : await addPartnerAdHocPayment({ partnerId, serviceId, name: paymentName.trim(), amount, paymentMethod: resolvedPaymentMethod, description: paymentDescription.trim() || undefined })
        setIsSubmitting(false)
        if (!result.success) { toast.error(result.error || "Failed to save payment"); return }
        toast.success(mode === "existing" ? "Project marked as paid" : "Paid item added")
        setIsOpen(false)
        router.refresh()
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {!hideTrigger ? <DialogTrigger asChild>{trigger || (
                <Button variant="default" className={cn("header-action-button", className)}>
                    <HandCoins className="h-5 w-5 md:h-4 md:w-4" strokeWidth={2.2} />
                    <span className={showLabelOnMobile ? "inline text-sm font-semibold" : "header-action-label"}>{label}</span>
                </Button>
            )}</DialogTrigger> : null}
            <DialogContent className="max-h-[90dvh] overflow-hidden p-0 sm:max-w-xl">
                <form onSubmit={handleSubmit} className="flex max-h-[90dvh] min-h-0 flex-col">
                    <DialogHeader className="shrink-0 border-b border-[var(--line-subtle)] px-5 py-5 sm:px-6"><DialogTitle>Record payment</DialogTitle></DialogHeader>
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                        <div className="grid grid-cols-2 rounded-[14px] bg-[var(--surface-low)] p-1" role="tablist" aria-label="Payment type">
                            {([['existing', 'Existing project'], ['new', 'New paid item']] as const).map(([value, text]) => (
                                <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => changeMode(value)} className={cn("h-9 rounded-[11px] px-3 text-xs font-semibold transition-all", mode === value ? "bg-[var(--surface-lowest)] text-[var(--brand-primary)] shadow-sm" : "text-[var(--text-secondary)]")}>{text}</button>
                            ))}
                        </div>

                        <PaymentCombobox label="Partner" placeholder="Choose partner" searchPlaceholder="Search partners…" value={partnerId} options={partners} autoFocus error={errors.partner} onChange={(value) => { setPartnerId(value); setProjects([]); setProjectId(""); setPaymentAmount(""); if (mode === "existing") setIsLoadingProjects(true); setErrors((current) => ({ ...current, partner: "", project: "" })) }} />

                        {mode === "existing" ? (
                            <PaymentCombobox label="Unpaid project" placeholder={!partnerId ? "Choose partner first" : isLoadingProjects ? "Loading projects…" : "Choose unpaid project"} searchPlaceholder="Search unpaid projects…" value={projectId} options={projects} disabled={!partnerId || isLoadingProjects} emptyLabel="No unpaid projects for this partner" error={errors.project} onChange={(value) => { const project = projects.find((entry) => entry.id === value); setProjectId(value); setPaymentAmount(project ? String(project.amount) : ""); setErrors((current) => ({ ...current, project: "" })) }} />
                        ) : (
                            <div className="space-y-2"><Label htmlFor="paymentName">Payment name</Label><Input id="paymentName" value={paymentName} onChange={(event) => { setPaymentName(event.target.value); setErrors((current) => ({ ...current, name: "" })) }} placeholder="e.g. Tracking setup" /><FieldError>{errors.name}</FieldError></div>
                        )}

                        {mode === "new" ? (
                            <div className="space-y-2"><Label htmlFor="paymentService">One-time service</Label><Select value={serviceId} onValueChange={(value) => { setServiceId(value); setErrors((current) => ({ ...current, service: "" })) }}><SelectTrigger id="paymentService" className="w-full"><SelectValue placeholder="Choose service" /></SelectTrigger><SelectContent>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select><FieldError>{errors.service || (services.length === 0 ? "Add a one-time service before recording a new item" : "")}</FieldError></div>
                        ) : null}

                        <div className="space-y-2"><Label htmlFor="paymentAmount">Amount (RON)</Label><Input id="paymentAmount" type="number" inputMode="decimal" step="0.01" min="0.01" value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value); setErrors((current) => ({ ...current, amount: "" })) }} placeholder="0.00" />{mode === "existing" && selectedProject ? <p className="text-xs text-[var(--text-muted)]">Updates the project fee when saved.</p> : null}<FieldError>{errors.amount}</FieldError></div>

                        <div className="space-y-2">
                            <Label htmlFor="paymentMethod">Payment method</Label>
                            <Select value={paymentMethod} onValueChange={(value) => { setPaymentMethod(value); setErrors((current) => ({ ...current, paymentMethod: "" })) }}>
                                <SelectTrigger id="paymentMethod" className="w-full"><SelectValue placeholder="Choose payment method" /></SelectTrigger>
                                <SelectContent>
                                    {mergePaymentMethods(paymentMethods).map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                                    <SelectItem value="__custom__">Add another method…</SelectItem>
                                </SelectContent>
                            </Select>
                            {paymentMethod === "__custom__" ? (
                                <Input value={customPaymentMethod} onChange={(event) => { setCustomPaymentMethod(event.target.value); setErrors((current) => ({ ...current, paymentMethod: "" })) }} maxLength={64} placeholder="Method name" autoFocus />
                            ) : null}
                            <FieldError>{errors.paymentMethod}</FieldError>
                        </div>

                        {mode === "new" ? <div className="space-y-2"><Label htmlFor="paymentDescription">Notes <span className="font-normal text-[var(--text-muted)]">(optional)</span></Label><Textarea id="paymentDescription" value={paymentDescription} onChange={(event) => setPaymentDescription(event.target.value)} rows={3} maxLength={2000} placeholder="Payment details" /></div> : null}
                    </div>
                    <DialogFooter className="shrink-0 border-t border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-5 py-4 sm:px-6">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" className="sm:min-w-36" disabled={isSubmitting || (mode === "new" && services.length === 0)}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{mode === "existing" ? "Mark as paid" : "Add paid item"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function FieldError({ children }: { children?: string }) { return children ? <p className="text-xs font-medium text-[var(--state-urgent)]">{children}</p> : null }

function PaymentCombobox({ label, placeholder, searchPlaceholder, value, options, onChange, disabled = false, autoFocus = false, error, emptyLabel = "No results" }: { label: string; placeholder: string; searchPlaceholder: string; value: string; options: Array<{ id: string; name: string }>; onChange: (value: string) => void; disabled?: boolean; autoFocus?: boolean; error?: string; emptyLabel?: string }) {
    const [open, setOpen] = useState(false)
    const selected = options.find((option) => option.id === value)
    return (
        <div className="space-y-2"><Label>{label}</Label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} autoFocus={autoFocus} disabled={disabled} className="h-10 w-full justify-between px-3 font-normal"><span className="truncate">{selected?.name || placeholder}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" onWheel={(event) => event.stopPropagation()}><Command><CommandInput placeholder={searchPlaceholder} /><CommandList className="max-h-[min(300px,45dvh)] overscroll-contain"><CommandEmpty>{emptyLabel}</CommandEmpty><CommandGroup>{options.map((option) => <CommandItem key={option.id} value={option.name} onSelect={() => { onChange(option.id); setOpen(false) }}><Check className={cn("mr-2 h-4 w-4", value === option.id ? "opacity-100" : "opacity-0")} />{option.name}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover><FieldError>{error}</FieldError></div>
    )
}
