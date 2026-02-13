"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { updateTask, toggleTaskStatus, deleteTasks, updateTasksStatus } from "@/lib/actions"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Users, Globe, Trash2, CheckCircle2, MoreVertical } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TasksCardViewProps {
    tasks: any[]
}

export function TasksCardView({ tasks }: TasksCardViewProps) {
    const [selectedTask, setSelectedTask] = React.useState<any>(null)
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [isBulkOperating, setIsBulkOperating] = React.useState(false)

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} tasks?`)) return
        setIsBulkOperating(true)
        try {
            const result = await deleteTasks(selectedIds)
            if (result.success) {
                toast.success("Tasks deleted")
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to delete tasks")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleBulkStatusUpdate = async (status: string) => {
        setIsBulkOperating(true)
        try {
            const result = await updateTasksStatus(selectedIds, status)
            if (result.success) {
                toast.success(`Tasks updated to ${status}`)
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to update tasks")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setIsBulkOperating(false)
        }
    }

    const handleStatusUpdate = async (taskId: string, status: string) => {
        setUpdatingId(taskId)
        try {
            const result = await updateTask(taskId, { status })
            if (result.success) {
                toast.success("Status updated")
            } else {
                toast.error(result.error || "Failed to update status")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUrgencyUpdate = async (taskId: string, urgency: string) => {
        setUpdatingId(taskId)
        try {
            const result = await updateTask(taskId, { urgency })
            if (result.success) {
                toast.success("Urgency updated")
            } else {
                toast.error(result.error || "Failed to update urgency")
            }
        } catch (error) {
            toast.error("Process failed")
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black uppercase tracking-widest text-primary">
                            {selectedIds.length} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-[10px] font-black uppercase tracking-tighter"
                                onClick={() => handleBulkStatusUpdate("Done")}
                                disabled={isBulkOperating}
                            >
                                Mark as Done
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-[10px] font-black uppercase tracking-tighter"
                                onClick={() => handleBulkStatusUpdate("Pending")}
                                disabled={isBulkOperating}
                            >
                                Mark as Pending
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] font-black uppercase tracking-tighter text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            onClick={handleBulkDelete}
                            disabled={isBulkOperating}
                        >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] font-black uppercase tracking-tighter"
                            onClick={() => setSelectedIds([])}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => (
                    <Card
                        key={task.id}
                        className={cn(
                            "group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 cursor-pointer border-dashed",
                            selectedIds.includes(task.id) ? "ring-2 ring-primary border-solid" : "bg-card/50"
                        )}
                        onClick={() => setSelectedTask(task)}
                    >
                        <CardContent className="p-5">
                            {/* Selection - Visible on hover/selected */}
                            <div
                                className={cn(
                                    "absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
                                    selectedIds.includes(task.id) && "opacity-100"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSelect(task.id)
                                }}
                            >
                                <Checkbox
                                    checked={selectedIds.includes(task.id)}
                                    className="h-5 w-5 border-2 border-primary/30 bg-background"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1 pl-7 flex-1 min-w-0">
                                        <h3 className={cn(
                                            "font-bold text-sm leading-tight transition-colors group-hover:text-primary break-words",
                                            task.isCompleted && "line-through text-muted-foreground opacity-60"
                                        )}>
                                            {task.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/80 italic bg-primary/5 px-2 py-0.5 rounded w-fit truncate">
                                            {task.project.name || task.project.site.domainName}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Badge className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest cursor-pointer hover:scale-105 transition-transform",
                                                    task.status === "Done" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                        task.status === "In Progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                                            "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                                )}>
                                                    {task.status}
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Pending")}>Pending</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "In Progress")}>In Progress</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Done")}>Done</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest cursor-pointer hover:scale-105 transition-transform",
                                                    task.urgency === "Urgent" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                                        task.urgency === "High" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                            "bg-slate-100 text-slate-500"
                                                )}>
                                                    {task.urgency || "Normal"}
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Low")}>Low</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Normal")}>Normal</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "High")}>High</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Urgent")}>Urgent</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Users className="h-3 w-3 opacity-40 shrink-0" />
                                            <span className="truncate">{task.project.site.partner.name}</span>
                                        </div>
                                        {task.deadline && (
                                            <div className={cn(
                                                "flex items-center gap-1.5 shrink-0 ml-auto",
                                                new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500 font-bold" : ""
                                            )}>
                                                <CalendarIcon className="h-3 w-3 opacity-40" />
                                                <span>{format(new Date(task.deadline), "MMM dd")}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground italic font-medium">
                                            <Clock className="h-3 w-3 opacity-30" />
                                            {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                                        </div>
                                        {task.isCompleted && (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-60" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {tasks.length === 0 && (
                    <div className="col-span-full h-40 flex items-center justify-center border border-dashed rounded-2xl bg-muted/20">
                        <p className="text-sm text-muted-foreground italic font-medium opacity-50">
                            No tasks found matching your criteria.
                        </p>
                    </div>
                )}
            </div>

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </div>
    )
}
