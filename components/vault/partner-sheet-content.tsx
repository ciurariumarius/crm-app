"use client"

import { useState, useEffect, useRef } from "react"
import { AlertCircle, Loader2, Plus, Trash2, Pencil, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { getPartnerById, addPartnerAdHocPayment, updatePartner, deletePartner } from "@/lib/actions/partners"
import { formatRelativeDate } from "@/lib/utils"
import { toast } from "sonner"
import { SitesListView } from "@/components/vault/sites-list-view"
import { SidePanelDangerZone, SidePanelLoadingState, SidePanelMetaBar, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"
import { SIDE_PANEL_DIALOG_HEADER_CLASS, sidePanelDialogContentClass } from "@/lib/ui/side-panels"
import type { Site } from "@prisma/client"
import { DEFAULT_PAYMENT_METHODS, normalizePaymentMethod } from "@/lib/payments/methods"

interface PartnerSheetContentProps {
    partnerId: string
}

type PartnerSheetData = {
    id: string
    name: string
    businessName?: string | null
    createdAt?: string | Date | null
    updatedAt?: string | Date | null
    isMainJob: boolean
    emailPrimary?: string | null
    emailSecondary?: string | null
    phone?: string | null
    internalNotes?: string | null
    sites: Array<Site & { _count?: { projects: number } }>
}

export function PartnerSheetContent({ partnerId, onClose }: PartnerSheetContentProps & { onClose?: () => void }) {
    const formRef = useRef<HTMLFormElement | null>(null)
    const [partner, setPartner] = useState<PartnerSheetData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Add Payment State
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [paymentName, setPaymentName] = useState("")
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentDesc, setPaymentDesc] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<string>(DEFAULT_PAYMENT_METHODS[0])
    const [customPaymentMethod, setCustomPaymentMethod] = useState("")
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

    // Edit Partner State
    const [isSavingPartner, setIsSavingPartner] = useState(false)
    const [isDeletingPartner, setIsDeletingPartner] = useState(false)
    const [isEditingName, setIsEditingName] = useState(false)
    const [editForm, setEditForm] = useState({
        name: "",
        businessName: "",
        isMainJob: false,
        emailPrimary: "",
        emailSecondary: "",
        phone: "",
        internalNotes: ""
    })

    const submitEditForm = () => {
        formRef.current?.requestSubmit()
    }

    useEffect(() => {
        let mounted = true
        async function loadPartner() {
            setLoading(true)
            const result = await getPartnerById(partnerId)
            if (!mounted) return
            if (result.success && result.partner) {
                const partnerData = result.partner as PartnerSheetData
                setPartner(partnerData)
                setEditForm({
                    name: partnerData.name,
                    businessName: partnerData.businessName || "",
                    isMainJob: partnerData.isMainJob,
                    emailPrimary: partnerData.emailPrimary || "",
                    emailSecondary: partnerData.emailSecondary || "",
                    phone: partnerData.phone || "",
                    internalNotes: partnerData.internalNotes || ""
                })
                setError(null)
            } else {
                setError(result.error || "Failed to load partner")
            }
            setLoading(false)
        }
        loadPartner()
        return () => { mounted = false }
    }, [partnerId])

    async function handleAddPayment(e: React.FormEvent) {
        e.preventDefault()
        if (!paymentName.trim()) {
            toast.error("Please provide a name for this payment")
            return
        }
        const amountNum = parseFloat(paymentAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error("Please provide a valid positive amount")
            return
        }
        const resolvedPaymentMethod = paymentMethod === "__custom__"
            ? normalizePaymentMethod(customPaymentMethod)
            : paymentMethod
        if (!resolvedPaymentMethod) {
            toast.error("Please choose or add a payment method")
            return
        }

        setIsSubmittingPayment(true)
        const result = await addPartnerAdHocPayment({
            partnerId,
            name: paymentName.trim(),
            amount: amountNum,
            paymentMethod: resolvedPaymentMethod,
            description: paymentDesc.trim() || undefined
        })
        setIsSubmittingPayment(false)

        if (result.success) {
            toast.success("Payment added successfully")
            setIsPaymentDialogOpen(false)
            setPaymentName("")
            setPaymentAmount("")
            setPaymentDesc("")
            setPaymentMethod(DEFAULT_PAYMENT_METHODS[0])
            setCustomPaymentMethod("")
            // Refresh partner data
            const refreshed = await getPartnerById(partnerId)
            if (refreshed.success && refreshed.partner) {
                setPartner(refreshed.partner as PartnerSheetData)
            }
        } else {
            toast.error(result.error || "Failed to add payment")
        }
    }

    async function handleSavePartner(e: React.FormEvent) {
        e.preventDefault()
        setIsSavingPartner(true)
        try {
            const result = await updatePartner(partnerId, editForm)
            if (result.success) {
                toast.success("Partner updated successfully")
                const refreshed = await getPartnerById(partnerId)
                if (refreshed.success && refreshed.partner) {
                    setPartner(refreshed.partner as PartnerSheetData)
                }
            } else {
                toast.error(result.error || "Failed to update partner")
            }
        } catch {
            toast.error("Failed to update partner")
        } finally {
            setIsSavingPartner(false)
        }
    }

    async function handleDeletePartner() {
        setIsDeletingPartner(true)
        try {
            const result = await deletePartner(partnerId)
            if (result.success) {
                toast.success("Partner deleted")
                if (onClose) onClose()
            } else {
                toast.error(result.error || "Failed to delete partner")
                setIsDeletingPartner(false)
            }
        } catch {
            toast.error("Failed to delete partner")
            setIsDeletingPartner(false)
        }
    }

    if (loading) {
        return (
            <div className="px-8 py-10">
                <SidePanelLoadingState message="Loading partner details..." />
            </div>
        )
    }

    if (error || !partner) {
        return (
            <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
                <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
                <p className="text-sm font-semibold text-destructive">{error || "Partner not found"}</p>
            </div>
        )
    }

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground">
            {/* Close Button - following Project side panel pattern */}
            <div className="absolute right-8 top-8 z-30 flex items-center gap-2">
                {onClose && (
                    <Button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                        aria-label="Close partner"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-6 pt-10">
                <div className="mx-auto max-w-[980px] space-y-8 pb-12">
                    {/* Title Section */}
                    <div className="space-y-4">
                        <div className="pr-12">
                            {isEditingName ? (
                                <Input
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    onBlur={() => {
                                        if (editForm.name.trim()) submitEditForm()
                                        setIsEditingName(false)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (editForm.name.trim()) submitEditForm()
                                            setIsEditingName(false)
                                        }
                                        if (e.key === 'Escape') {
                                            if (partner) setEditForm({ ...editForm, name: partner.name })
                                            setIsEditingName(false)
                                        }
                                    }}
                                    className="text-[28px] font-black leading-none tracking-tight text-[var(--text-primary)] h-auto p-0 border-none bg-transparent focus-visible:ring-0 md:text-3xl"
                                    autoFocus
                                />
                            ) : (
                                <div className="group flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingName(true)}>
                                    <h2 className="ui-text-title text-[var(--text-primary)] group-hover:text-primary transition-colors md:text-3xl">{partner.name}</h2>
                                    <Pencil className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                            {partner.businessName && !isEditingName && (
                                <p className="mt-2 ui-overline text-[var(--text-muted)]">{partner.businessName}</p>
                            )}
                        </div>

                        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm rounded-lg font-semibold text-[var(--text-primary)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)]">
                                    <Plus className="h-4 w-4" />
                                    Add Payment
                                </Button>
                            </DialogTrigger>
                            <DialogContent className={sidePanelDialogContentClass("compact")}>
                                <DialogHeader className={SIDE_PANEL_DIALOG_HEADER_CLASS}>
                                    <DialogTitle>Add Payment</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddPayment} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name (Project)</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g. Domain Renewals"
                                            value={paymentName}
                                            onChange={(e) => setPaymentName(e.target.value)}
                                            required
                                        />
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
                                    <div className="space-y-2">
                                        <Label htmlFor="partner-payment-method">Payment method</Label>
                                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                            <SelectTrigger id="partner-payment-method" className="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {DEFAULT_PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                                                <SelectItem value="__custom__">Add another method…</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {paymentMethod === "__custom__" ? <Input value={customPaymentMethod} onChange={(event) => setCustomPaymentMethod(event.target.value)} maxLength={64} placeholder="Method name" autoFocus /> : null}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="desc">Description (Optional)</Label>
                                        <Textarea
                                            id="desc"
                                            placeholder="Optional details..."
                                            className="h-20"
                                            value={paymentDesc}
                                            onChange={(e) => setPaymentDesc(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter className="pt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsPaymentDialogOpen(false)}
                                            disabled={isSubmittingPayment}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={isSubmittingPayment}>
                                            {isSubmittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Payment
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="space-y-8 animate-in fade-in-0 duration-300">
                        <form ref={formRef} onSubmit={handleSavePartner} className="space-y-6">
                            <Card className="shadow-sm border-[var(--line-subtle)] bg-[var(--surface-lowest)]">
                                <CardContent className="pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-1">
                                            <Label htmlFor="edit-businessName">Business Name</Label>
                                            <Input
                                                id="edit-businessName"
                                                value={editForm.businessName}
                                                onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                                                onBlur={submitEditForm}
                                                placeholder="Corporate LLC"
                                                className="h-9 bg-[var(--surface-low)] border-[var(--line-subtle)] focus:bg-[var(--surface-lowest)] transition-all"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between border p-3 rounded-xl shadow-sm bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] h-[64px]">
                                            <Label htmlFor="edit-type" className="flex flex-col gap-1 cursor-pointer">
                                                <span className="ui-text-caption font-semibold text-[var(--text-primary)]">Partner type</span>
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs ${!editForm.isMainJob ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)] font-medium"}`}>Freelance</span>
                                                <Switch
                                                    id="edit-type"
                                                    checked={editForm.isMainJob}
                                                    onCheckedChange={(checked) => {
                                                        setEditForm({ ...editForm, isMainJob: checked })
                                                        setIsSavingPartner(true)
                                                        updatePartner(partnerId, { ...editForm, isMainJob: checked }).then(() => setIsSavingPartner(false))
                                                    }}
                                                />
                                                <span className={`text-xs ${editForm.isMainJob ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)] font-medium"}`}>Main Job</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-emailPrimary">Primary Email</Label>
                                            <Input
                                                id="edit-emailPrimary"
                                                type="email"
                                                value={editForm.emailPrimary}
                                                onChange={(e) => setEditForm({ ...editForm, emailPrimary: e.target.value })}
                                                onBlur={submitEditForm}
                                                placeholder="primary@example.com"
                                                className="h-9 bg-[var(--surface-low)] border-[var(--line-subtle)] focus:bg-[var(--surface-lowest)] transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-phone">Phone</Label>
                                            <Input
                                                id="edit-phone"
                                                type="tel"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                onBlur={submitEditForm}
                                                placeholder="+40..."
                                                className="h-9 bg-[var(--surface-low)] border-[var(--line-subtle)] focus:bg-[var(--surface-lowest)] transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-[var(--line-subtle)]">
                                        <Label htmlFor="edit-notes" className="ui-overline text-[var(--text-secondary)]">Internal notes</Label>
                                        <Textarea
                                            id="edit-notes"
                                            value={editForm.internalNotes}
                                            onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                                            onBlur={submitEditForm}
                                            placeholder="Invoicing details, contact info..."
                                            className="min-h-[100px] bg-[var(--surface-low)] border-[var(--line-subtle)] focus:bg-[var(--surface-lowest)] transition-all text-sm"
                                        />
                                    </div>
                                    {isSavingPartner && (
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] italic">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Saving changes...
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </form>

                        <div>
                            <SidePanelSectionTitle title="Partner domains" className="mb-4" />
                            <div className="rounded-2xl border border-[var(--line-subtle)]/60 bg-[var(--surface-lowest)] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                <SitesListView sites={partner.sites || []} partnerId={partner.id} />
                            </div>
                        </div>

                        <SidePanelDangerZone
                            title="Danger zone"
                            description="Delete this partner and all related data."
                        >
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" className="gap-2 shadow-sm font-semibold h-9">
                                            <Trash2 className="h-4 w-4" />
                                            Delete Partner
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Partner?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete <span className="font-semibold text-foreground">{partner.name}</span> and all associated sites/projects. This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeletePartner} disabled={isDeletingPartner} className="bg-destructive hover:bg-destructive/90 font-bold">
                                                {isDeletingPartner ? "Deleting..." : "Delete Partner"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                        </SidePanelDangerZone>

                        <SidePanelMetaBar
                            className="mt-2 pt-6"
                            entityLabel="Partner ID"
                            entityId={partner.id.slice(0, 8)}
                            createdAt={formatRelativeDate(partner.createdAt)}
                            updatedAt={formatRelativeDate(partner.updatedAt || partner.createdAt)}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
