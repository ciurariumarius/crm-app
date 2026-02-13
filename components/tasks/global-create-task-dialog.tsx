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
import { addTask } from "@/lib/actions"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface GlobalCreateTaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: { id: string; siteName: string; services: { serviceName: string }[] }[]
}

export function GlobalCreateTaskDialog({ open, onOpenChange, projects }: GlobalCreateTaskDialogProps) {
    const [name, setName] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProjectId) return

        setIsLoading(true)
        try {
            const result = await addTask(selectedProjectId, name)
            if (result.success) {
                toast.success("Task created")
                setName("")
                setSelectedProjectId("")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to create task")
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
                    <DialogTitle>Add New Task</DialogTitle>
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
                                        {p.siteName} - {p.services.map((s: any) => s.serviceName).join(", ")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Task Name</Label>
                        <Input
                            placeholder="e.g. Update Ad Copy"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !selectedProjectId || !name}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Task
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
