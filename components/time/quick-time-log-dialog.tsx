"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { logTime } from "@/lib/actions"
import { toast } from "sonner"
import { Loader2, Plus, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickTimeLogDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    taskId?: string
    taskName?: string
    projectName?: string
}

export function QuickTimeLogDialog({
    open,
    onOpenChange,
    projectId,
    taskId,
    taskName,
    projectName
}: QuickTimeLogDialogProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleQuickLog = async (minutes: number) => {
        if (!projectId) return

        setIsLoading(true)
        try {
            const durationSeconds = minutes * 60

            const result = await logTime({
                projectId,
                taskId,
                description: `Quick log: ${minutes}m`,
                durationSeconds,
                startTime: new Date(),
            })

            if (result.success) {
                toast.success(`Logged ${minutes}m`)
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to log time")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsLoading(false)
        }
    }

    const presets = [5, 10, 15, 30, 45, 60, 90, 120, 180]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Quick Log Time
                    </DialogTitle>
                    <DialogDescription>
                        Select duration to log for <span className="font-semibold text-foreground">{taskName || projectName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-3 py-4">
                    {presets.map((mins) => (
                        <Button
                            key={mins}
                            variant="outline"
                            className="h-12 text-sm font-medium hover:bg-primary hover:text-primary-foreground border-primary/20"
                            onClick={() => handleQuickLog(mins)}
                            disabled={isLoading}
                        >
                            {mins >= 60 ? `${mins / 60}h ${mins % 60 > 0 ? mins % 60 + 'm' : ''}` : `${mins} min`}
                        </Button>
                    ))}
                </div>

                {isLoading && (
                    <div className="flex justify-center pb-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
