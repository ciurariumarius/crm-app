"use client"

import { useState } from "react"
import { createService } from "@/lib/actions/services"
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
import { Plus } from "lucide-react"

export function CreateServiceDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        serviceName: "",
        isRecurring: "false",
        standardTasks: "", // Multi-line string
        sopLink: "",
        baseFee: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await createService({
                serviceName: formData.serviceName,
                isRecurring: formData.isRecurring === "true",
                standardTasks: formData.standardTasks.split("\n").filter(Boolean),
                sopLink: formData.sopLink,
                baseFee: formData.baseFee ? parseFloat(formData.baseFee) : undefined
            })
            setOpen(false)
            setFormData({ serviceName: "", isRecurring: "false", standardTasks: "", sopLink: "", baseFee: "" })
            toast.success("Service created")
        } catch (error) {
            console.error(error)
            toast.error("Failed to create service")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center flex-shrink-0" title="New Service">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Service Template</DialogTitle>
                        <DialogDescription>
                            Add a new service to your library.
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
                            {loading ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
