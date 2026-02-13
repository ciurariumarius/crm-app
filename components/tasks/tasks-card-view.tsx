"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { updateTask, toggleTaskStatus, deleteTasks, updateTasksStatus } from "@/lib/actions"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Users, Globe, Trash2, CheckCircle2, MoreVertical, Briefcase } from "lucide-react"
import { TaskDetails } from "./task-details"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

interface TasksCardViewProps {
    tasks: any[]
    allServices: any[]
}

export function TasksCardView({ tasks, allServices }: TasksCardViewProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const [selectedSite, setSelectedSite] = React.useState<any>(null)
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
        <div className="space-y-6">
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center justify-between p-2 pl-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in zoom-in duration-300 backdrop-blur-md">
                    <div className="flex items-center gap-6">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {selectedIds.length} Selected
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Completed")}
                                disabled={isBulkOperating}
                            >
                                Complete
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-[10px] font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 border border-border"
                                onClick={() => handleBulkStatusUpdate("Active")}
                                disabled={isBulkOperating}
                            >
                                Activate
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/10"
                            onClick={handleBulkDelete}
                            disabled={isBulkOperating}
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} />
                            Delete
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setSelectedIds([])}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map((task) => (
                    <Card
                        key={task.id}
                        className={cn(
                            "group relative overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/5 border-border",
                            selectedIds.includes(task.id) ? "ring-1 ring-primary/50 bg-primary/[0.02]" : "bg-card"
                        )}
                        onClick={() => setSelectedTask(task)}
                    >
                        <CardContent className="p-6">
                            {/* Selection */}
                            <div
                                className={cn(
                                    "absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
                                    selectedIds.includes(task.id) && "opacity-100"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggleSelect(task.id)
                                }}
                            >
                                <Checkbox
                                    checked={selectedIds.includes(task.id)}
                                    className="h-4 w-4 rounded-[4px] border-border bg-muted data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5 pl-7 flex-1 min-w-0">
                                        <h3 className={cn(
                                            "font-semibold text-[15px] leading-snug tracking-tight transition-colors group-hover:text-primary break-words",
                                            task.isCompleted && "text-muted-foreground/40"
                                        )}>
                                            {task.name}
                                        </h3>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Badge className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0 border-none shadow-none cursor-pointer",
                                                    task.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                                                        task.status === "Active" ? "bg-primary/10 text-primary" :
                                                            "bg-orange-500/10 text-orange-600"
                                                )}>
                                                    {task.status}
                                                </Badge>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-popover border-border">
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Active")}>Active</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Paused")}>Paused</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(task.id, "Completed")}>Completed</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    task.urgency === "Urgent" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" :
                                                        task.urgency === "High" ? "bg-amber-500" :
                                                            "bg-muted-foreground/20"
                                                )} />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-popover border-border">
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Low")}>Low</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Normal")}>Normal</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "High")}>High</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUrgencyUpdate(task.id, "Urgent")}>Urgent</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 text-[11px] font-medium text-muted-foreground/60">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Users className="h-3.5 w-3.5 opacity-40 shrink-0" strokeWidth={1.5} />
                                            <span className="truncate">{task.project.site.partner.name}</span>
                                        </div>
                                        {task.deadline && (
                                            <div className={cn(
                                                "flex items-center gap-2 shrink-0 ml-auto px-2 py-0.5 rounded-md bg-muted/50 border border-border",
                                                new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500 border-rose-500/20" : ""
                                            )}>
                                                <CalendarIcon className="h-3.5 w-3.5 opacity-40" strokeWidth={1.5} />
                                                <span>{format(new Date(task.deadline), "MMM dd")}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 pt-4 border-t border-border">
                                        {/* Project Sideview Link */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedProject(task.project)
                                            }}
                                            className="group/project flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Briefcase className="h-3.5 w-3.5 text-primary opacity-60 group-hover/project:opacity-100" strokeWidth={1.5} />
                                                <span className="text-[11px] font-semibold text-foreground/80 group-hover/project:text-foreground transition-colors truncate">
                                                    {task.project.name || task.project.site.domainName}
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold opacity-0 group-hover/project:opacity-40 transition-opacity">PROJ</div>
                                        </div>

                                        {/* Site Sideview Link */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setSelectedSite(task.project.site)
                                            }}
                                            className="group/site flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Globe className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/site:text-primary transition-colors" strokeWidth={1.5} />
                                                <span className="text-[11px] font-medium text-muted-foreground group-hover/site:text-foreground transition-colors truncate">
                                                    {task.project.site.domainName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {tasks.length === 0 && (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-muted/30">
                        <Clock className="h-8 w-8 text-muted-foreground/20 mb-4" strokeWidth={1} />
                        <p className="text-sm text-muted-foreground/60 font-medium">
                            No active tasks found in this view.
                        </p>
                    </div>
                )}
            </div>

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />

            {/* Project Details Sheet */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
                <SheetContent side="right" className="sm:max-w-[800px] w-full p-0 flex flex-col border-none shadow-xl bg-background backdrop-blur-3xl overflow-hidden">
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            onUpdate={(updated) => setSelectedProject((prev: any) => ({ ...prev, ...updated }))}
                            onOpenSite={(site) => setSelectedSite(site)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background backdrop-blur-3xl shadow-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => setSelectedSite({ ...selectedSite, ...updated })}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
