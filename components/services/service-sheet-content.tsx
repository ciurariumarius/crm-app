"use client"

import { useState } from "react"
import type { Prisma } from "@prisma/client"
import { updateService, deleteService } from "@/lib/actions/services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { X, CheckCircle2, Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { formatRelativeDate } from "@/lib/utils"
import { SidePanelChip, SidePanelDangerZone, SidePanelMetaBar, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"

import {
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"

interface ServiceSheetContentProps {
    service: ServiceSheetItem
    onUpdate?: (updatedService: Partial<ServiceSheetItem> & { id: string }) => void
    onClose?: () => void
}

type ServiceSheetItem = {
    id: string
    serviceName: string
    isRecurring: boolean
    standardTasks: string
    sopLink?: string | null
    baseFee?: Prisma.Decimal | string | number | null
    createdAt: Date | string
    updatedAt?: Date | string | null
}

export function ServiceSheetContent({ service, onUpdate, onClose }: ServiceSheetContentProps) {
    const [loading, setLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    let initialTasks = ""
    try {
        initialTasks = JSON.parse(service.standardTasks).join("\n")
    } catch { }

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
                onUpdate({
                    ...service,
                    serviceName: updatedData.serviceName,
                    isRecurring: updatedData.isRecurring,
                    standardTasks: JSON.stringify(updatedData.standardTasks),
                    sopLink: updatedData.sopLink,
                    baseFee: updatedData.baseFee ?? null,
                })
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
                    <SidePanelChip
                        tone={formData.isRecurring === "true" ? "blue" : "slate"}
                        label={formData.isRecurring === "true" ? "Recurring" : "One-time"}
                        className="px-2.5 py-1 text-[10px]"
                    />
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
                            <SidePanelSectionTitle title="Type" className="text-xs" />
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
                            <SidePanelSectionTitle title="Base fee" className="text-xs" />
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
                        <SidePanelSectionTitle title="Standard tasks (template)" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
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

                    <SidePanelDangerZone
                        title="Danger zone"
                        description="Delete this service template. Existing projects keep their stored data."
                        className="border-slate-200"
                    >
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDeleting ? <AlertTriangle className="h-3.5 w-3.5 mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                                {isDeleting ? "Confirm delete" : "Delete template"}
                            </Button>
                            {isDeleting && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDeleting(false)}
                                    className="h-8 rounded-lg px-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </SidePanelDangerZone>
                </div>
            </div>

            <div className="bg-white px-8 pb-4">
                <SidePanelMetaBar
                    className="mt-0 pt-4"
                    entityLabel="Service ID"
                    entityId={service.id.slice(0, 8)}
                    createdAt={formatRelativeDate(service.createdAt)}
                    updatedAt={formatRelativeDate(service.updatedAt || service.createdAt)}
                />
            </div>
        </div>
    )
}
