"use client"

import * as React from "react"
import { TaskDetails, type TaskDetailsTask } from "@/components/tasks/task-details"

type TaskSheetTask = {
    id: string
    project?: unknown
    [key: string]: unknown
}

interface TaskSheetWrapperProps {
    tasks: TaskSheetTask[]
    project?: unknown // Optional project context to inject into tasks
    children: React.ReactNode
}

// Create a context to manage task sheet state
export const TaskSheetContext = React.createContext<{
    openTask: (taskId: string, taskData?: TaskSheetTask) => void
    closeTask: () => void
    currentTask: TaskSheetTask | null
}>({
    openTask: () => { },
    closeTask: () => { },
    currentTask: null
})

export function TaskSheetWrapper({ tasks, project, children }: TaskSheetWrapperProps) {
    const [selectedTask, setSelectedTask] = React.useState<TaskSheetTask | null>(null)

    const openTask = (taskId: string, taskData?: TaskSheetTask) => {
        const task = taskData || tasks.find((entry) => entry.id === taskId)
        if (task) {
            // Inject project context if available and missing on task
            const taskWithContext = project ? { ...task, project: task.project || project } : task
            setSelectedTask(taskWithContext)
        }
    }

    const closeTask = () => {
        setSelectedTask(null)
    }

    // Update selected task if it changes in the list (e.g. after editing)
    React.useEffect(() => {
        if (selectedTask) {
            const updated = tasks.find((entry) => entry.id === selectedTask.id)
            if (updated) {
                // Re-inject project context
                const updatedWithContext = project ? { ...updated, project: updated.project || project } : updated

                // Compare the fully constructed objects to prevent infinite loops
                if (JSON.stringify(updatedWithContext) !== JSON.stringify(selectedTask)) {
                    setSelectedTask(updatedWithContext)
                }
            }
        }
    }, [tasks, selectedTask, project])

    return (
        <TaskSheetContext.Provider value={{ openTask, closeTask, currentTask: selectedTask }}>
            {children}
            <TaskDetails
                task={selectedTask as TaskDetailsTask | null}
                open={!!selectedTask}
                onOpenChange={(open) => !open && closeTask()}
            />
        </TaskSheetContext.Provider>
    )
}
