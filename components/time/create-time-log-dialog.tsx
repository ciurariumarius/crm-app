"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { logTime } from "@/lib/actions/time"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CreateTimeLogDialogProps {
    projects: { id: string; siteName: string }[]
    tasks: { id: string; name: string; projectId: string }[]
}

export function CreateTimeLogDialog({ projects, tasks }: CreateTimeLogDialogProps) {
    const [open, setOpen] = useState(false)
    const [hours, setHours] = useState("")
    const [description, setDescription] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined)
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
                taskId: selectedTaskId === "none" ? undefined : selectedTaskId,
                description,
                durationSeconds,
                startTime: new Date(),
            })

            if (result.success) {
                toast.success("Time logged")
                resetForm()
                setOpen(false)
            } else {
                toast.error(result.error || "Failed to log time")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsLoading(false)
        }
    }

    const resetForm = () => {
        setHours("")
        setDescription("")
        setSelectedProjectId("")
        setSelectedTaskId(undefined)
    }

    const filteredTasks = selectedProjectId
        ? tasks.filter(t => t.projectId === selectedProjectId)
        : []

    const setPresetTime = (minutes: number) => {
        setHours((minutes / 60).toString())
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center flex-shrink-0" title="Add new log time">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Log Time Entry</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Project</Label>
                        <Select value={selectedProjectId} onValueChange={(val) => {
                            setSelectedProjectId(val)
                            setSelectedTaskId(undefined)
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.siteName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Task (Optional)</Label>
                        <Select
                            value={selectedTaskId || "none"}
                            onValueChange={(val) => setSelectedTaskId(val === "none" ? undefined : val)}
                            disabled={!selectedProjectId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a task" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">General (No specific task)</SelectItem>
                                {filteredTasks.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Duration (Hours)</Label>
                        <div className="flex gap-2 mb-2">
                            {[30, 60, 90].map((mins) => (
                                <Button
                                    key={mins}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPresetTime(mins)}
                                    className="text-xs h-7"
                                >
                                    {mins}m
                                </Button>
                            ))}
                        </div>
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
                        <Label>Description</Label>
                        <Input
                            placeholder="What did you work on?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !selectedProjectId || !hours}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Log
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
