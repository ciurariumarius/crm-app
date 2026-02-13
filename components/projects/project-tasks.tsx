"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Loader2, Play } from "lucide-react"
import { addTask, toggleTaskStatus, deleteTask } from "@/lib/actions"
import { useTimer } from "@/components/providers/timer-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Task {
    id: string
    name: string
    status: string
}

export function ProjectTasks({ projectId, initialTasks }: { projectId: string, initialTasks: Task[] }) {
    const [newTaskName, setNewTaskName] = useState("")
    const [loading, setLoading] = useState<string | null>(null)
    const { startTimer } = useTimer()

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

    const sortedTasks = [...initialTasks].sort((a, b) => {
        if (a.status === "Done" && b.status !== "Done") return 1
        if (a.status !== "Done" && b.status === "Done") return -1
        return 0
    })

    return (
        <div className="space-y-6">
            <div className="relative group">
                <Input
                    placeholder="Capture new operation..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    className="h-12 bg-card border-border focus:border-primary/40 focus:ring-0 rounded-2xl pl-10 pr-12 text-sm font-medium transition-all"
                />
                <Plus className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />
                <Button
                    size="icon"
                    onClick={handleAddTask}
                    disabled={loading === "add" || !newTaskName.trim()}
                    className={cn(
                        "absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl transition-all",
                        newTaskName.trim() ? "btn-primary hover:opacity-90" : "bg-muted/50 text-muted-foreground/40"
                    )}
                >
                    {loading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
                </Button>
            </div>

            <div className="space-y-3">
                {sortedTasks.map((task) => (
                    <div
                        key={task.id}
                        className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border border-transparent transition-all duration-300 group hover:scale-[1.01] hover:border-primary/20",
                            task.status === "Done"
                                ? "bg-muted/20"
                                : "bg-card border-border hover:bg-muted/30"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <Checkbox
                                checked={task.status === "Done"}
                                onCheckedChange={() => handleToggle(task.id, task.status)}
                                disabled={loading === task.id}
                                className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <span className={cn(
                                "text-[13px] font-medium transition-all",
                                task.status === "Done"
                                    ? "line-through text-muted-foreground/40"
                                    : "text-foreground group-hover:text-primary"
                            )}>
                                {task.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            {task.status !== "Done" && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                    onClick={() => startTimer(projectId, task.id, task.name)}
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl bg-rose-500/5 text-rose-500/40 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                onClick={() => handleDelete(task.id)}
                                disabled={loading === task.id}
                            >
                                {loading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.5} />}
                            </Button>
                        </div>
                    </div>
                ))}

                {initialTasks.length === 0 && (
                    <div className="text-center py-10 bg-muted/20 rounded-3xl border border-dashed border-border">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Empty Queue</div>
                        <p className="text-[10px] text-muted-foreground/30 mt-1 uppercase tracking-widest font-medium">No active operations detected</p>
                    </div>
                )}
            </div>
        </div>
    )
}
