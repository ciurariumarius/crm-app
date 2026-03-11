"use client"

import { useState } from "react"
import { updateService, deleteService } from "@/lib/actions/services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Check, X, Clock, CheckCircle2, Expand, Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn, formatRelativeDate } from "@/lib/utils"

import {
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"

interface ServiceSheetContentProps {
    service: any
    onUpdate?: (updatedService: any) => void
    onClose?: () => void
}

export function ServiceSheetContent({ service, onUpdate, onClose }: ServiceSheetContentProps) {
    const [loading, setLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

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

    const handleDelete = async () => {
        if (!isDeleting) {
            setIsDeleting(true)
            return
        }

        setLoading(true)
        try {
            const result = await deleteService(service.id)
            if (result.success) {
                toast.success("Service deleted")
                if (onClose) onClose()
            } else {
                toast.error(result.error || "Failed to delete service")
                setIsDeleting(false)
            }
        } catch (error) {
            console.error(error)
            toast.error("An error occurred during deletion")
            setIsDeleting(false)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] w-full">
            {/* Header */}
            <SheetHeader className="px-8 pt-9 pb-6 relative bg-transparent">
                <div className="absolute right-6 top-6 z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="space-y-4 pr-16 text-left">
                    <Badge variant={formData.isRecurring === "true" ? "default" : "secondary"} className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">
                        {formData.isRecurring === "true" ? "Recurring" : "One-Time"}
                    </Badge>
                    <SheetTitle className="group relative">
                        <Input
                            value={formData.serviceName}
                            onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                            onBlur={handleSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="text-2xl font-semibold leading-tight tracking-[-0.02em] border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto w-full text-slate-900"
                            placeholder="Service Name"
                        />
                    </SheetTitle>
                </div>
            </SheetHeader>

            {/* Content Scroller */}
            <div className="flex-1 overflow-y-auto px-8 pb-6 pt-0">
                <div className="space-y-8 pb-20">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 rounded-2xl border border-slate-200 bg-white p-5 premium-card shadow-sm">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Type</Label>
                            <Select
                                value={formData.isRecurring}
                                onValueChange={(val) => setFormData({ ...formData, isRecurring: val })}
                            >
                                <SelectTrigger className="h-12 w-full justify-start rounded-xl border border-slate-200 bg-slate-50 text-left text-sm font-semibold shadow-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="false" className="font-semibold px-4">One-time Project</SelectItem>
                                    <SelectItem value="true" className="font-semibold px-4">Recurring Fee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Base Fee</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold uppercase tracking-widest">RON</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.baseFee}
                                    onChange={(e) => setFormData({ ...formData, baseFee: e.target.value })}
                                    onBlur={handleSave}
                                    placeholder="0.00"
                                    className="pl-14 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Standard Tasks (Template)
                        </Label>
                        <div className="relative group">
                            <Textarea
                                className="min-h-[300px] font-mono text-sm leading-relaxed bg-white border-slate-200 rounded-2xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all p-5 shadow-sm"
                                placeholder="Enter one task per line..."
                                value={formData.standardTasks}
                                onChange={(e) => setFormData({ ...formData, standardTasks: e.target.value })}
                                onBlur={handleSave}
                            />
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 italic px-1">
                            These tasks will be automatically added when you create a new project with this service.
                        </p>
                    </div>

                    <div className="pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={handleDelete}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDeleting ? <AlertTriangle className="h-3.5 w-3.5 mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                            {isDeleting ? "Confirm Delete Service Template" : "Delete Service Template"}
                        </Button>
                        {isDeleting && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsDeleting(false)}
                                className="ml-2 h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-200 bg-white px-6 py-3 text-[11px] font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span># Service ID: {service.id.slice(0, 8)}</span>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="inline-flex items-center gap-1.5">
                        Created: {formatRelativeDate(service.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        Last updated: {formatRelativeDate(service.updatedAt)}
                    </span>
                </div>
            </div>
        </div>
    )
}
