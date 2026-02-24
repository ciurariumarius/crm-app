import { useState, useContext } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Loader2, Play, AlertCircle, Clock, CheckCircle2, ChevronDown } from "lucide-react"
import { addTask, toggleTaskStatus, deleteTask, updateTask } from "@/lib/actions/tasks"
import { useTimer } from "@/components/providers/timer-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Task } from "@prisma/client"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export function ProjectTasks({ projectId, initialTasks }: { projectId: string, initialTasks: any[] }) {
    const [newTaskName, setNewTaskName] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const { startTimer } = useTimer()
    const { openTask } = useContext(TaskSheetContext)

    const handleAddTask = async () => {
        if (!newTaskName.trim()) return
        setLoading("add")
        try {
            const result = await addTask(projectId, newTaskName)
            if (result.success) {
                setNewTaskName("")
                toast.success("Task added")
            } else {
                toast.error(result.error || "Failed to add task")
            }
        } catch (error) {
            toast.error("Failed to add task")
        } finally {
            setLoading(null)
        }
    }

    const handleToggle = async (taskId: string, currentStatus: string) => {
        setLoading(taskId)
        try {
            const result = await toggleTaskStatus(taskId, currentStatus, projectId)
            if (!result.success) {
                toast.error(result.error || "Failed to update status")
            }
        } catch (error) {
            toast.error("Failed to update status")
        } finally {
            setLoading(null)
        }
    }

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setLoading(taskId)
        try {
            const result = await updateTask(taskId, {
                status: newStatus
            })
            if (result.success) {
                toast.success("Status updated")
            } else {
                toast.error(result.error || "Failed to update status")
            }
        } catch (error) {
            toast.error("Failed to update status")
        } finally {
            setLoading(null)
        }
    }

    const handleDelete = async (taskId: string) => {
        setLoading(taskId)
        try {
            const result = await deleteTask(taskId, projectId)
            if (result.success) {
                toast.success("Task deleted")
            } else {
                toast.error(result.error || "Failed to delete task")
            }
        } catch (error) {
            toast.error("Failed to delete task")
        } finally {
            setLoading(null)
        }
    }

    const handleUpdateEstimate = async (taskId: string, minutes: number) => {
        try {
            await updateTask(taskId, { estimatedMinutes: minutes })
            toast.success("Estimate updated")
        } catch (error) {
            toast.error("Failed to update estimate")
        }
    }

    const sortedTasks = [...initialTasks].sort((a, b) => {
        if (a.status === "Completed" && b.status !== "Completed") return 1
        if (a.status !== "Completed" && b.status === "Completed") return -1
        return 0
    })

    return (
        <div className="space-y-6">
            <div className="relative group">
                <Input
                    placeholder="Add task..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    className="h-10 bg-card border-border focus:border-primary/40 focus:ring-0 rounded-xl pl-9 pr-12 text-sm font-medium transition-all"
                />
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />
                <Button
                    size="icon"
                    onClick={handleAddTask}
                    disabled={loading === "add" || !newTaskName.trim()}
                    className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg transition-all",
                        newTaskName.trim() ? "btn-primary hover:opacity-90" : "bg-muted/50 text-muted-foreground/40"
                    )}
                >
                    {loading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
                </Button>
            </div>

            <div className="space-y-2">
                {sortedTasks.map((task) => {
                    const actualMinutes = task.timeLogs ? Math.floor(task.timeLogs.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) / 60) : 0

                    return (
                        <div
                            key={task.id}
                            className={cn(
                                "group relative flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all duration-300 hover:border-primary/20",
                                task.status === "Completed" ? "bg-muted/20" : "bg-card border-border hover:bg-muted/30"
                            )}
                        >
                            {/* Clickable Area Overlay */}
                            <div
                                className="absolute inset-0 cursor-pointer z-0"
                                onClick={() => openTask(task.id)}
                            />

                            {/* Checkbox (Z-Index above overlay) */}
                            <div className="relative z-10 flex-shrink-0">
                                <Checkbox
                                    checked={task.status === "Completed"}
                                    onCheckedChange={() => handleToggle(task.id, task.status)}
                                    disabled={loading === task.id}
                                    className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                            </div>

                            {/* Task Name & Metadata Grid */}
                            <div className="flex-1 grid grid-cols-12 gap-4 items-center relative z-0 pointer-events-none">
                                {/* Name */}
                                <div className={cn(
                                    "col-span-5 text-[13px] font-medium truncate transition-all",
                                    task.status === "Completed" ? "line-through text-muted-foreground/40" : "text-foreground"
                                )}>
                                    {task.name}
                                </div>

                                {/* Status Badge */}
                                <div className="col-span-3 pointer-events-auto">
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    disabled={task.status === "Completed"}
                                                    className="h-6 w-fit min-w-[80px] text-[10px] font-bold uppercase tracking-wider bg-transparent border-transparent hover:bg-muted/50 px-2 rounded-md transition-colors flex items-center gap-1"
                                                >
                                                    <span className={cn(
                                                        task.status === "Active" ? "text-emerald-600" :
                                                            task.status === "Paused" ? "text-orange-500" : "text-muted-foreground"
                                                    )}>{task.status}</span>
                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, "Active")}>
                                                    <span className="text-emerald-600 font-bold text-xs">ACTIVE</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, "Paused")}>
                                                    <span className="text-orange-500 font-bold text-xs">PAUSED</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleStatusChange(task.id, "Completed")}>
                                                    <span className="text-muted-foreground font-bold text-xs">COMPLETED</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                {/* Priority Badge */}
                                <div className="col-span-2 flex justify-center pointer-events-auto">
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <div className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                            task.urgency === "Critical" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                                task.urgency === "High" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                                                    task.urgency === "Normal" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                                        "bg-slate-500/10 text-slate-600 border-slate-500/20"
                                        )}>
                                            {task.urgency || "Normal"}
                                        </div>
                                    </div>
                                </div>

                                {/* Time (Est / Act) */}
                                <div className="col-span-2 flex items-center justify-end gap-3 pointer-events-auto">
                                    <div className="flex flex-col items-end leading-none" onClick={(e) => e.stopPropagation()}>
                                        {/* Estimation Input */}
                                        <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-muted-foreground/50 hover:text-foreground transition-colors group/est">
                                            <span className="opacity-0 group-hover/est:opacity-100 transition-opacity text-[9px] uppercase tracking-wider">Est</span>
                                            <input
                                                className="w-12 bg-transparent text-right hover:text-foreground focus:text-foreground focus:outline-none transition-colors placeholder:text-muted-foreground/30"
                                                defaultValue={task.estimatedMinutes || ""}
                                                placeholder="Set"
                                                onBlur={(e) => {
                                                    const val = e.target.value === "" ? 0 : parseInt(e.target.value)
                                                    if (!isNaN(val) && val !== task.estimatedMinutes) {
                                                        handleUpdateEstimate(task.id, val)
                                                    }
                                                }}
                                            />
                                            {task.estimatedMinutes > 0 && <span className="text-[9px]">m</span>}
                                        </div>

                                        {/* Actual duration (Only if > 0) */}
                                        {actualMinutes > 0 && (
                                            <div className="text-[10px] font-bold text-emerald-600/80 mt-0.5 flex items-center gap-1" title="Actual Time">
                                                <span>{actualMinutes}m</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions (Hover) */}
                            <div className="relative z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2 w-14 justify-end">
                                {task.status !== "Completed" && (
                                    <button
                                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            startTimer(projectId, task.id, task.name)
                                        }}
                                    >
                                        <Play className="h-3 w-3 fill-current" />
                                    </button>
                                )}
                                <button
                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(task.id)
                                    }}
                                    disabled={loading === task.id}
                                >
                                    {loading === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" strokeWidth={1.5} />}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
