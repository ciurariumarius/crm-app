"use client"

import * as React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Trash2, Loader2, Globe, Users, Target, X } from "lucide-react"
import { updateTask, deleteTask } from "@/lib/actions"
import { toast } from "sonner"
import { cn, formatProjectName } from "@/lib/utils"

interface TaskDetailsProps {
    task: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskDetails({ task, open, onOpenChange }: TaskDetailsProps) {
    const [loading, setLoading] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)

    // Form state
    const [name, setName] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [status, setStatus] = React.useState("")
    const [urgency, setUrgency] = React.useState("")
    const [deadline, setDeadline] = React.useState<Date | undefined>(undefined)

    // Sync form state with task
    React.useEffect(() => {
        if (task) {
            setName(task.name || "")
            setDescription(task.description || "")
            setStatus(task.status || "Active")
            setUrgency(task.urgency || "Normal")
            setDeadline(task.deadline ? new Date(task.deadline) : undefined)
        }
    }, [task])

    const handleUpdate = async () => {
        if (!task) return
        setLoading(true)
        try {
            const result = await updateTask(task.id, {
                name,
                description,
                status,
                urgency,
                deadline,
            })

            if (result.success) {
                toast.success("Task updated")
            } else {
                toast.error(result.error || "Failed to update task")
            }
        } catch (error) {
            toast.error("Failed to update task")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!task) return
        setIsDeleting(true)
        try {
            const result = await deleteTask(task.id, task.projectId)
            if (result.success) {
                toast.success("Task deleted")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Failed to delete task")
            }
        } catch (error) {
            toast.error("Failed to delete task")
        } finally {
            setIsDeleting(false)
        }
    }

    if (!task) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="sm:max-w-[700px] w-full p-0 flex flex-col border-none shadow-2xl">
                <SheetHeader className="p-8 border-b bg-muted/20 relative">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground/60">
                            <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {task.project.site.partner.name}
                            </div>
                            <span className="opacity-30">/</span>
                            <div className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {task.project.site.domainName}
                            </div>
                        </div>
                        <SheetTitle className="group relative">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && name !== task.name) {
                                                handleUpdate()
                                            }
                                            if (e.key === 'Escape') {
                                                setName(task.name || "")
                                            }
                                        }}
                                        className="text-3xl font-bold tracking-tight border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto pr-24"
                                        placeholder="Task Name"
                                    />
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            name !== task.name && (
                                                <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                                        onClick={handleUpdate}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                                        onClick={() => setName(task.name || "")}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                                {name !== task.name && (
                                    <div className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                        Unsaved Name Change
                                    </div>
                                )}
                            </div>
                        </SheetTitle>

                        <div className="flex items-center gap-2">
                            {task.status === "Completed" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 text-[10px] font-black tracking-widest px-2 py-0.5">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> COMPLETED
                                </Badge>
                            ) : task.status === "Active" ? (
                                <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20 text-[10px] font-black tracking-widest px-2 py-0.5">
                                    <Clock className="h-3 w-3 mr-1" /> ACTIVE
                                </Badge>
                            ) : (
                                <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/20 text-[10px] font-black tracking-widest px-2 py-0.5">
                                    <AlertCircle className="h-3 w-3 mr-1" /> PAUSED
                                </Badge>
                            )}
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">
                                Task Context: {task.project.services?.[0]?.serviceName || "General Operations"}
                            </span>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-8 space-y-12">
                    {/* Status & Deadline Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lifecycle Status</label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-12 text-sm font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active" className="text-xs font-bold text-blue-500">ACTIVE</SelectItem>
                                    <SelectItem value="Paused" className="text-xs font-bold text-orange-500">PAUSED</SelectItem>
                                    <SelectItem value="Completed" className="text-xs font-bold text-emerald-500">COMPLETED</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Urgency Level</label>
                            <Select value={urgency} onValueChange={setUrgency}>
                                <SelectTrigger className="h-12 text-sm font-bold bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20">
                                    <SelectValue placeholder="Select urgency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low" className="text-xs font-bold">LOW</SelectItem>
                                    <SelectItem value="Normal" className="text-xs font-bold">NORMAL</SelectItem>
                                    <SelectItem value="High" className="text-xs font-bold text-amber-500">HIGH</SelectItem>
                                    <SelectItem value="Urgent" className="text-xs font-bold text-rose-500">URGENT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deadline Tracking</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-bold h-12 text-sm bg-muted/30 border-none shadow-none focus:ring-1 focus:ring-primary/20",
                                            !deadline && "text-muted-foreground/40"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deadline ? format(deadline, "PPP") : <span>Set Deadline</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={deadline}
                                        onSelect={setDeadline}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description / Technical Notes</label>
                        </div>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[200px] bg-muted/30 border-none shadow-none focus-visible:ring-primary/20 text-sm font-medium resize-none leading-relaxed p-4 rounded-xl"
                            placeholder="Add details, technical requirements, or SOP references..."
                        />
                    </div>

                    {/* CONTEXT SECTION */}
                    <section className="space-y-6 pt-6 border-t border-dashed">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" /> Operations Context
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-transparent">
                                <div className="space-y-0.5">
                                    <div className="font-bold text-sm text-primary italic">
                                        {formatProjectName(task.project) || "General Project"}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                                    <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Partner</div>
                                    <div className="text-xs font-bold text-muted-foreground truncate">{task.project.site.partner.name}</div>
                                </div>
                                <div className="p-4 bg-muted/10 rounded-xl space-y-1">
                                    <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Domain</div>
                                    <div className="text-xs font-bold text-muted-foreground truncate">{task.project.site.domainName}</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center justify-between gap-4 pt-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-12 px-6 font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete Task
                        </Button>

                        <Button
                            size="sm"
                            className="h-12 px-10 font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 rounded-xl"
                            onClick={handleUpdate}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </div>
                </div>

                <div className="p-8 border-t bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Creation Date</div>
                            <div className="text-sm font-bold">{format(new Date(task.createdAt), "MMMM do, yyyy")}</div>
                        </div>
                    </div>
                    <div className="text-[10px] font-mono font-medium text-muted-foreground opacity-40 italic text-right">
                        Ref ID: {task.id.slice(0, 8)}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
