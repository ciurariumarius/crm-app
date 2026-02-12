"use client"

import { Button } from "@/components/ui/button"
import { Plus, Briefcase, CheckSquare } from "lucide-react"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { useState } from "react"

interface QuickActionsProps {
    partners: any[]
    services: any[]
}

export function QuickActions({ partners, services }: QuickActionsProps) {
    const [showProjectDialog, setShowProjectDialog] = useState(false)

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
                    asChild
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-9 px-4 font-medium text-xs"
                >
                    <a href="/projects">
                        <Briefcase className="h-4 w-4" />
                        All Projects
                    </a>
                </Button>

                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-9 px-4 font-medium text-xs"
                >
                    <a href="/projects?status=Active">
                        <CheckSquare className="h-4 w-4" />
                        Active Tasks
                    </a>
                </Button>
            </div>

            <GlobalCreateProjectDialog
                partners={partners}
                services={services}
                open={showProjectDialog}
                onOpenChange={setShowProjectDialog}
            />
        </div>
    )
}
