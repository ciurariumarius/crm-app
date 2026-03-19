"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addPartnerAdHocPayment } from "@/lib/actions/partners"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function AddPartnerPaymentDialog({ partners }: { partners: { id: string, name: string }[] }) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [partnerId, setPartnerId] = useState("")
    const [paymentName, setPaymentName] = useState("")
    const [paymentAmount, setPaymentAmount] = useState("")
    const [paymentDesc, setPaymentDesc] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        
        if (!partnerId) {
            toast.error("Please select a partner")
            return
        }

        if (!paymentName.trim()) {
            toast.error("Please provide a name for this payment")
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
            name: paymentName.trim(),
            amount: amountNum,
            description: paymentDesc.trim() || undefined
        })
        setIsSubmitting(false)

        if (result.success) {
            toast.success("Payment added successfully")
            setIsOpen(false)
            setPartnerId("")
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
            <DialogTrigger asChild>
                <Button variant="default" className="h-9 gap-2 shadow-sm rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
                    <Plus className="h-4 w-4" />
                    Add Payment
                </Button>
            </DialogTrigger>
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
