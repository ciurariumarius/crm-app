"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Loader2, Play } from "lucide-react"
import { addTask, toggleTaskStatus, deleteTask } from "@/lib/actions"
import { useTimer } from "@/components/providers/timer-provider"
import { toast } from "sonner"

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
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="New task description..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                />
                <Button size="icon" onClick={handleAddTask} disabled={loading === "add"}>
                    {loading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
            </div>

            <div className="space-y-2">
                {sortedTasks.map((task) => (
                    <div
                        key={task.id}
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors group ${task.status === "Done" ? "bg-muted/50" : "hover:bg-muted/30"}`}
                    >
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={task.status === "Done"}
                                onCheckedChange={() => handleToggle(task.id, task.status)}
                                disabled={loading === task.id}
                            />
                            <span className={`text-sm ${task.status === "Done" ? "line-through text-muted-foreground" : ""}`}>
                                {task.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.status !== "Done" && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-primary"
                                    onClick={() => startTimer(projectId, task.id, task.name)}
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(task.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}

                {initialTasks.length === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        No tasks yet. Create one above.
                    </div>
                )}
            </div>
        </div>
    )
}
