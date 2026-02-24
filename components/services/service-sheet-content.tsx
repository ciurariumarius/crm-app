"use client"

import { useState } from "react"
import { updateService } from "@/lib/actions/services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Check, X, Clock, CheckCircle2, Expand } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface ServiceSheetContentProps {
    service: any
    onUpdate?: (updatedService: any) => void
}

export function ServiceSheetContent({ service, onUpdate }: ServiceSheetContentProps) {
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

    const handleSave = async () => {
        setLoading(true)
        try {
            const updatedData = {
                serviceName: formData.serviceName,
                isRecurring: formData.isRecurring === "true",
                standardTasks: formData.standardTasks.split("\n").filter(Boolean),
                sopLink: formData.sopLink,
                baseFee: formData.baseFee ? parseFloat(formData.baseFee) : undefined
            }

            await updateService(service.id, updatedData)

            toast.success("Service updated")
            if (onUpdate) {
                onUpdate({ ...service, ...updatedData, standardTasks: JSON.stringify(updatedData.standardTasks) })
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to update service")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background w-full">
            {/* Header */}
            <div className="p-6 border-b bg-muted/20 shrink-0 space-y-4">
                <div className="flex items-center justify-between">
                    <Badge variant={formData.isRecurring === "true" ? "default" : "secondary"} className="uppercase tracking-widest text-[10px]">
                        {formData.isRecurring === "true" ? "Recurring" : "One-Time"}
                    </Badge>
                    <Link href={`/services/${service.id}`} className="transition-all hover:text-primary">
                        <Expand className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Link>
                </div>

                <div className="space-y-1">
                    <Input
                        value={formData.serviceName}
                        onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        className="text-3xl font-black italic tracking-tighter border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto w-full"
                        placeholder="Service Name"
                    />
                </div>
            </div>

            {/* Content Scroller */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</Label>
                        <Select
                            value={formData.isRecurring}
                            onValueChange={(val) => setFormData({ ...formData, isRecurring: val })}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">One-time Project</SelectItem>
                                <SelectItem value="true">Recurring Fee</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base Fee</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">RON</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.baseFee}
                                onChange={(e) => setFormData({ ...formData, baseFee: e.target.value })}
                                placeholder="0.00"
                                className="pl-10 h-9 font-mono"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Standard Tasks (Template)
                    </Label>
                    <Textarea
                        className="min-h-[200px] font-mono text-xs leading-relaxed bg-muted/10 border-muted-foreground/10 focus-visible:ring-1"
                        placeholder="Enter one task per line..."
                        value={formData.standardTasks}
                        onChange={(e) => setFormData({ ...formData, standardTasks: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                        These tasks will be automatically added when you create a new project with this service.
                    </p>
                </div>
            </div>

            <div className="p-4 border-t bg-muted/10 flex justify-end shrink-0">
                <Button onClick={handleSave} disabled={loading} size="sm" className="font-bold">
                    {loading ? "Saving..." : "Save Template"}
                </Button>
            </div>
        </div>
    )
}
