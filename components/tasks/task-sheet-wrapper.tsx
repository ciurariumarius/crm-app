"use client"

import * as React from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TaskDetails } from "@/components/tasks/task-details"

interface TaskSheetWrapperProps {
    tasks: any[]
    project?: any // Optional project context to inject into tasks
    children: React.ReactNode
}

// Create a context to manage task sheet state
export const TaskSheetContext = React.createContext<{
    openTask: (taskId: string) => void
    closeTask: () => void
    currentTask: any | null
}>({
    openTask: () => { },
    closeTask: () => { },
    currentTask: null
})

export function TaskSheetWrapper({ tasks, project, children }: TaskSheetWrapperProps) {
    const [selectedTask, setSelectedTask] = React.useState<any>(null)

    const openTask = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId)
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
            const updated = tasks.find(t => t.id === selectedTask.id)
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
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && closeTask()}
            />
        </TaskSheetContext.Provider>
    )
}
