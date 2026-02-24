"use client"

import { useState } from "react"
import { updateService } from "@/lib/actions/services"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Edit2 } from "lucide-react"

interface Service {
    id: string
    serviceName: string
    isRecurring: boolean
    standardTasks: string // JSON string
    sopLink: string | null
    baseFee: any // Decimal
}

export function EditServiceDialog({ service }: { service: Service }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    let initialTasks = ""
    try {
        initialTasks = JSON.parse(service.standardTasks).join("\n")
    } catch (e) { }

    const [formData, setFormData] = useState({
        serviceName: service.serviceName,
        isRecurring: service.isRecurring.toString(),
        standardTasks: initialTasks,
        sopLink: service.sopLink || "",
        baseFee: service.baseFee?.toString() || ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await updateService(service.id, {
                serviceName: formData.serviceName,
                isRecurring: formData.isRecurring === "true",
                standardTasks: formData.standardTasks.split("\n").filter(Boolean),
                sopLink: formData.sopLink,
                baseFee: formData.baseFee ? parseFloat(formData.baseFee) : undefined
            })
            setOpen(false)
            toast.success("Service updated")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update service")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Service Template</DialogTitle>
                        <DialogDescription>
                            Update this service template.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid items-center gap-4">
                            <Label htmlFor="name" className="text-left">
                                Service Name
                            </Label>
                            <Input
                                id="name"
                                value={formData.serviceName}
                                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid items-center gap-4">
                            <Label htmlFor="type" className="text-left">
                                Type
                            </Label>
                            <Select
                                value={formData.isRecurring}
                                onValueChange={(val) => setFormData({ ...formData, isRecurring: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="false">One-time Project</SelectItem>
                                    <SelectItem value="true">Recurring Fee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center gap-4">
                            <Label htmlFor="baseFee" className="text-left">
                                Base Fee (RON)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">RON</span>
                                <Input
                                    id="baseFee"
                                    type="number"
                                    step="0.01"
                                    value={formData.baseFee}
                                    onChange={(e) => setFormData({ ...formData, baseFee: e.target.value })}
                                    placeholder="0.00"
                                    className="pl-12"
                                />
                            </div>
                        </div>
                        <div className="grid items-center gap-4">
                            <Label htmlFor="tasks" className="text-left">
                                Standard Tasks (One per line)
                            </Label>
                            <Textarea
                                id="tasks"
                                className="col-span-3 min-h-[100px]"
                                placeholder="Setup GA4...&#10;Verify Tracking..."
                                value={formData.standardTasks}
                                onChange={(e) => setFormData({ ...formData, standardTasks: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Updating..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
