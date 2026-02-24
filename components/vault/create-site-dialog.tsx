"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSite } from "@/lib/actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function CreateSiteDialog({
    partnerId: initialPartnerId,
    partners
}: {
    partnerId?: string
    partners?: { id: string; name: string }[]
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [domainName, setDomainName] = useState("")
    const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartnerId || "")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const targetPartnerId = initialPartnerId || selectedPartnerId
        if (!targetPartnerId) {
            toast.error("Please select a partner")
            return
        }
        setLoading(true)
        try {
            await createSite(targetPartnerId, domainName)
            setOpen(false)
            setDomainName("")
            if (!initialPartnerId) setSelectedPartnerId("")
            toast.success("Site created")
        } catch (error) {
            console.error(error)
            toast.error("Failed to create site")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center flex-shrink-0" title="Add Site">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Site</DialogTitle>
                        <DialogDescription>
                            {initialPartnerId ? "Add a new website to this partner." : "Assign a new website to a partner."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {!initialPartnerId && partners && (
                            <div className="grid gap-2">
                                <Label htmlFor="partnerSelect">Select Partner</Label>
                                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                                    <SelectTrigger id="partnerSelect">
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
                        <div className="grid items-center gap-4">
                            <Label htmlFor="domain">Domain Name</Label>
                            <Input
                                id="domain"
                                value={domainName}
                                onChange={(e) => setDomainName(e.target.value)}
                                placeholder="example.com"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Site"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
