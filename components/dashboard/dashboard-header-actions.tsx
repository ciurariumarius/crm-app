"use client"

import * as React from "react"
import { Plus, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"

interface DashboardHeaderActionsProps {
    partners: any[]
    services: any[]
    activeProjects: any[]
}

export function DashboardHeaderActions({ partners, services, activeProjects }: DashboardHeaderActionsProps) {
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    return (
        <div className="flex items-center justify-center gap-3">
            <Button
                size="default"
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center gap-2 flex-shrink-0 font-bold"
                onClick={() => setCreateProjectOpen(true)}
            >
                <span className="text-sm">Add Project</span>
                <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>

            <Button
                size="default"
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center gap-2 flex-shrink-0 font-bold"
                onClick={() => setCreateTaskOpen(true)}
            >
                <span className="text-sm">Add Task</span>
                <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>

            <GlobalCreateProjectDialog
                partners={partners}
                services={services}
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
            />
            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={activeProjects}
            />
        </div>
    )
}
