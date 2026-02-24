"use client"

import { useState } from "react"
import { createPartner } from "@/lib/actions"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function CreatePartnerDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        isMainJob: false,
        internalNotes: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await createPartner(formData)
            setOpen(false)
            setFormData({ name: "", isMainJob: false, internalNotes: "" })
            toast.success("Partner created successfully")
        } catch (error) {
            console.error(error)
            toast.error("Failed to create partner")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center flex-shrink-0" title="Add Partner">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Partner</DialogTitle>
                        <DialogDescription>
                            Create a new container for sites and projects.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid items-center gap-4">
                            <Label htmlFor="name">Partner Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. LMS, DOT, Sergio"
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="type">Main Job / Contract</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Freelance</span>
                                <Switch
                                    id="type"
                                    checked={formData.isMainJob}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isMainJob: checked })}
                                />
                                <span className="text-sm font-medium">Main Job</span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Internal Notes</Label>
                            <Textarea
                                id="notes"
                                value={formData.internalNotes}
                                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                                placeholder="Invoicing details, contact info..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Partner"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
