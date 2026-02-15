"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { updateTimeLog, deleteTimeLog } from "@/lib/actions"
import { toast } from "sonner"

interface TimeLogSheetProps {
    log: any | null
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: any[]
    tasks: any[]
}

export function TimeLogSheet({ log, open, onOpenChange, projects, tasks }: TimeLogSheetProps) {
    const [projectId, setProjectId] = React.useState<string>("")
    const [taskId, setTaskId] = React.useState<string>("no-task") // 'no-task' for general project time
    const [description, setDescription] = React.useState("")
    const [date, setDate] = React.useState<Date | undefined>(undefined)
    const [startTime, setStartTime] = React.useState("")
    const [durationHours, setDurationHours] = React.useState("")
    const [durationMinutes, setDurationMinutes] = React.useState("")
    const [isSaving, setIsSaving] = React.useState(false)

    React.useEffect(() => {
        if (log && open) {
            setProjectId(log.projectId)
            setTaskId(log.taskId || "no-task")
            setDescription(log.description || "")

            const start = new Date(log.startTime)
            setDate(start)
            setStartTime(format(start, "HH:mm"))

            const seconds = log.durationSeconds || 0
            setDurationHours(Math.floor(seconds / 3600).toString())
            setDurationMinutes(Math.floor((seconds % 3600) / 60).toString())
        }
    }, [log, open])

    const filteredTasks = React.useMemo(() => {
        if (!projectId) return []
        return tasks.filter((t: any) => t.projectId === projectId)
    }, [projectId, tasks])

    const handleSave = async () => {
        if (!log || !date || !projectId) return

        setIsSaving(true)
        try {
            // Parse start time
            const [hours, mins] = startTime.split(":").map(Number)
            const newStartTime = new Date(date)
            newStartTime.setHours(hours || 0, mins || 0)

            // Calculate duration
            const durationSecs = (parseInt(durationHours || "0") * 3600) + (parseInt(durationMinutes || "0") * 60)

            // Calculate end time
            const newEndTime = new Date(newStartTime.getTime() + durationSecs * 1000)

            const result = await updateTimeLog(log.id, {
                projectId,
                taskId: taskId === "no-task" ? null : taskId,
                description,
                startTime: newStartTime,
                endTime: newEndTime,
                durationSeconds: durationSecs
            })

            if (result.success) {
                toast.success("Time entry updated")
                onOpenChange(false)
            } else {
                toast.error("Failed to update time entry")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this time entry?")) return

        setIsSaving(true)
        try {
            const result = await deleteTimeLog(log.id)
            if (result.success) {
                toast.success("Time entry deleted")
                onOpenChange(false)
            } else {
                toast.error("Failed to delete time entry")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsSaving(false)
        }
    }

    if (!log) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] w-full p-0 flex flex-col border-l border-border bg-background shadow-2xl">
                <SheetHeader className="p-6 border-b border-border bg-muted/10">
                    <SheetTitle>Edit Time Entry</SheetTitle>
                    <SheetDescription>
                        Modify the details of your time log.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Read-only Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="flex flex-col">
                            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-60">Created</span>
                            <span>{format(new Date(log.createdAt), "PP pp")}</span>
                        </div>
                        <div className="h-8 w-[1px] bg-border mx-2" />
                        <div className="flex flex-col items-end">
                            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-60">ID</span>
                            <span className="font-mono">{log.id.slice(0, 8)}...</span>
                        </div>
                    </div>

                    {/* Project & Task */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project">Project</Label>
                            <Select value={projectId} onValueChange={(val) => {
                                setProjectId(val)
                                setTaskId("no-task") // Reset task when project changes
                            }}>
                                <SelectTrigger id="project">
                                    <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="task">Task (Optional)</Label>
                            <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                                <SelectTrigger id="task" className={cn(!projectId && "opacity-50")}>
                                    <SelectValue placeholder={projectId ? "Select task or leave empty" : "Select project first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-task" className="text-muted-foreground italic">No specific task</SelectItem>
                                    {filteredTasks.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Time Details */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={setDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startTime">Start Time</Label>
                                <Input
                                    id="startTime"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Duration</Label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={durationHours}
                                        onChange={(e) => setDurationHours(e.target.value)}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                                </div>
                                <div className="relative flex-1">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={durationMinutes}
                                        onChange={(e) => setDurationMinutes(e.target.value)}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What did you work on?"
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    </div>
                </div>

                <SheetFooter className="p-6 border-t border-border bg-muted/10 flex-row justify-between items-center sm:justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        onClick={handleDelete}
                        disabled={isSaving}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
