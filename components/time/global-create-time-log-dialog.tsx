"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { logTime } from "@/lib/actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

import { QuickActionProject } from "@/types"

interface GlobalCreateTimeLogDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: QuickActionProject[]
}

export function GlobalCreateTimeLogDialog({ open, onOpenChange, projects }: GlobalCreateTimeLogDialogProps) {
    const [hours, setHours] = useState("")
    const [description, setDescription] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProjectId) return

        setIsLoading(true)
        try {
            // Convert hours to seconds
            const durationSeconds = parseFloat(hours) * 3600

            const result = await logTime({
                projectId: selectedProjectId,
                description,
                durationSeconds,
                startTime: new Date(),
                // No task ID for generic quick add
            })

            if (result.success) {
                toast.success("Time logged")
                setHours("")
                setDescription("")
                setSelectedProjectId("")
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Log Time</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Project</Label>
                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects?.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.siteName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Hours</Label>
                        <Input
                            placeholder="e.g. 1.5"
                            type="number"
                            step="0.1"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Reason / Task</Label>
                        <Input
                            placeholder="e.g. Weekly Optimization"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !selectedProjectId || !hours}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Log Time
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
