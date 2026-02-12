"use client"

import { useState } from "react"
import { updatePartner, deletePartner } from "@/lib/actions"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"

// Define a type for the partner prop to avoid 'any'
interface Partner {
    id: string
    name: string
    businessName: string | null
    isMainJob: boolean
    emailPrimary: string | null
    emailSecondary: string | null
    phone: string | null
    internalNotes: string | null
}

export function EditPartnerDialog({ partner }: { partner: Partner }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        name: partner.name,
        businessName: partner.businessName || "",
        isMainJob: partner.isMainJob,
        emailPrimary: partner.emailPrimary || "",
        emailSecondary: partner.emailSecondary || "",
        phone: partner.phone || "",
        internalNotes: partner.internalNotes || ""
    })

    // Update local state when dialog opens or partner changes
    // (Optional: useEffect to sync if partner prop updates, but usually unnecessary for this modal pattern)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await updatePartner(partner.id, formData)
            setOpen(false)
            toast.success("Partner updated successfully")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update partner")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await deletePartner(partner.id)
            setOpen(false)
            toast.success("Partner deleted")
            // Router refresh or redirect is handled by server action revalidating path, 
            // but if we are on the detail page we might want to redirect.
            // Since this dialog is on the card in the list view, revalidation removes the card.
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete partner")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSave}>
                    <DialogHeader>
                        <DialogTitle>Edit Partner</DialogTitle>
                        <DialogDescription>
                            Update partner details and contact info.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Core Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Display Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Business Name</Label>
                                <Input
                                    id="businessName"
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    placeholder="Legal Entity LLC"
                                />
                            </div>
                        </div>

                        {/* Type Toggle */}
                        <div className="flex items-center justify-between border p-3 rounded-md">
                            <Label htmlFor="edit-type" className="flex flex-col">
                                <span>Partner Type</span>
                                <span className="font-normal text-xs text-muted-foreground">Affects tax categorization</span>
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm ${!formData.isMainJob ? "font-medium" : "text-muted-foreground"}`}>Freelance</span>
                                <Switch
                                    id="edit-type"
                                    checked={formData.isMainJob}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isMainJob: checked })}
                                />
                                <span className={`text-sm ${formData.isMainJob ? "font-medium" : "text-muted-foreground"}`}>Main Job</span>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2">
                            <Label htmlFor="emailPrimary">Primary Email</Label>
                            <Input
                                id="emailPrimary"
                                type="email"
                                value={formData.emailPrimary}
                                onChange={(e) => setFormData({ ...formData, emailPrimary: e.target.value })}
                                placeholder="primary@example.com"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="emailSecondary">Secondary Email</Label>
                                <Input
                                    id="emailSecondary"
                                    type="email"
                                    value={formData.emailSecondary}
                                    onChange={(e) => setFormData({ ...formData, emailSecondary: e.target.value })}
                                    placeholder="billing@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Internal Notes</Label>
                            <Textarea
                                id="edit-notes"
                                value={formData.internalNotes}
                                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                                placeholder="Invoicing details, contact info..."
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" type="button" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete
                                        <span className="font-medium text-foreground"> {partner.name} </span>
                                        and all associated <span className="font-medium text-foreground">Sites, Projects, and Time Logs</span>.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                        Delete Partner
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <div className="flex gap-2">
                            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
