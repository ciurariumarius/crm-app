"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addPartnerAdHocPayment, getPartnerProjectsForPayment } from "@/lib/actions/partners"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type AddPartnerPaymentDialogProps = {
    partners: { id: string; name: string }[]
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: ReactNode
    hideTrigger?: boolean
}

export function AddPartnerPaymentDialog({
    partners,
    open,
    onOpenChange,
    trigger,
    hideTrigger = false
}: AddPartnerPaymentDialogProps) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [partnerId, setPartnerId] = useState("")
    const [projectId, setProjectId] = useState("")
    const [paymentName, setPaymentName] = useState("")
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentDesc, setPaymentDesc] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [partnerProjects, setPartnerProjects] = useState<Array<{ id: string; name: string; amount: number; paymentStatus: string }>>([])
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
            toast.error("Please select a project or provide a payment name")
            return
        }
        
        const amountNum = parseFloat(paymentAmount)
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error("Please provide a valid positive amount")
            return
        }

        setIsSubmitting(true)
        const result = await addPartnerAdHocPayment({
            partnerId,
            projectId: projectId || undefined,
            name: trimmedName || undefined,
            amount: amountNum,
            description: paymentDesc.trim() || undefined
        })
        setIsSubmitting(false)

        if (result.success) {
            toast.success("Payment added successfully")
            setIsOpen(false)
            setPartnerId("")
            setProjectId("")
            setPartnerProjects([])
            setPaymentName("")
            setPaymentAmount("")
            setPaymentDesc("")
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
                        <Button variant="default" className="h-9 gap-2 shadow-sm rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
                            <Plus className="h-4 w-4" />
                            Add Payment
                        </Button>
                    )}
                </DialogTrigger>
            ) : null}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Payment to Partner</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="partner">Partner</Label>
                        <Select value={partnerId} onValueChange={setPartnerId} required>
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
                    <div className="space-y-2">
                        <Label htmlFor="project">Project (Optional)</Label>
                        <Select
                            value={projectId || "__none__"}
                            onValueChange={(value) => {
                                const nextProjectId = value === "__none__" ? "" : value
                                setProjectId(nextProjectId)
                                if (!nextProjectId) return
                                const selected = partnerProjects.find((project) => project.id === nextProjectId)
                                if (selected && !paymentName.trim()) {
                                    setPaymentName(selected.name)
                                }
                            }}
                            disabled={!partnerId || isLoadingProjects}
                        >
                            <SelectTrigger id="project">
                                <SelectValue
                                    placeholder={
                                        !partnerId
                                            ? "Select a partner first"
                                            : isLoadingProjects
                                                ? "Loading projects..."
                                                : "Optional: choose a project"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">No project (ad-hoc payment)</SelectItem>
                                {partnerProjects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedProject ? (
                            <p className="text-xs text-muted-foreground">
                                Selected: {selectedProject.paymentStatus} • {selectedProject.amount} RON
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                You can leave this empty and add a custom payment name.
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Payment Name {projectId ? "(Optional)" : ""}</Label>
                        <Input
                            id="name"
                            placeholder={projectId ? "Optional override name" : "e.g. Domain Renewals"}
                            value={paymentName}
                            onChange={(e) => setPaymentName(e.target.value)}
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
                            onClick={() => setIsOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
