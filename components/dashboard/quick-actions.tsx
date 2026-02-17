"use client"

import { Button } from "@/components/ui/button"
import { Plus, Briefcase, CheckSquare, Clock } from "lucide-react"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateTimeLogDialog } from "@/components/time/global-create-time-log-dialog"
import { useState } from "react"

import { PartnerWithSites, QuickActionProject } from "@/types"
import { Service } from "@prisma/client"

interface QuickActionsProps {
    partners: PartnerWithSites[]
    services: Service[]
    projects: QuickActionProject[]
}

export function QuickActions({ partners, services, projects }: QuickActionsProps) {
    const [showProjectDialog, setShowProjectDialog] = useState(false)
    const [showTaskDialog, setShowTaskDialog] = useState(false)
    const [showTimeLogDialog, setShowTimeLogDialog] = useState(false)

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border/60">
                <Button
                    onClick={() => setShowProjectDialog(true)}
                    className="btn-primary h-9 px-4 text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                >
                    <Plus className="h-4 w-4 mr-2" strokeWidth={3} />
                    Project
                </Button>
                <div className="w-px h-5 bg-border/60 mx-1" />
                <Button
                    onClick={() => setShowTaskDialog(true)}
                    variant="ghost"
                    size="sm"
                    className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                    <CheckSquare className="h-4 w-4 mr-2" strokeWidth={2} />
                    Task
                </Button>
            </div>

            <Button
                onClick={() => setShowTimeLogDialog(true)}
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-full border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-50 transition-all"
                title="Log Time"
            >
                <Clock className="h-5 w-5" strokeWidth={2.5} />
            </Button>

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
