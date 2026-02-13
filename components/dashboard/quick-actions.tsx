"use client"

import { Button } from "@/components/ui/button"
import { Plus, Briefcase, CheckSquare, Clock } from "lucide-react"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateTimeLogDialog } from "@/components/time/global-create-time-log-dialog"
import { useState } from "react"

interface QuickActionsProps {
    partners: any[]
    services: any[]
    projects: any[]
}

export function QuickActions({ partners, services, projects }: QuickActionsProps) {
    const [showProjectDialog, setShowProjectDialog] = useState(false)
    const [showTaskDialog, setShowTaskDialog] = useState(false)
    const [showTimeLogDialog, setShowTimeLogDialog] = useState(false)

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-muted/50">
                <Button
                    onClick={() => setShowProjectDialog(true)}
                    size="sm"
                    className="gap-2 h-9 px-4 font-bold text-xs uppercase tracking-wider"
                >
                    <Plus className="h-4 w-4" />
                    New Project
                </Button>

                <Button
                    onClick={() => setShowTaskDialog(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9 px-4 font-medium text-xs"
                >
                    <CheckSquare className="h-4 w-4" />
                    New Task
                </Button>

                <Button
                    onClick={() => setShowTimeLogDialog(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2 h-9 px-4 font-medium text-xs"
                >
                    <Clock className="h-4 w-4" />
                    Log Time
                </Button>
            </div>

            <GlobalCreateProjectDialog
                partners={partners}
                services={services}
                open={showProjectDialog}
                onOpenChange={setShowProjectDialog}
            />

            <GlobalCreateTaskDialog
                open={showTaskDialog}
                onOpenChange={setShowTaskDialog}
                projects={projects}
            />

            <GlobalCreateTimeLogDialog
                open={showTimeLogDialog}
                onOpenChange={setShowTimeLogDialog}
                projects={projects}
            />
        </div>
    )
}
