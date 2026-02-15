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
        <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 bg-card p-2 rounded-full border border-border shadow-sm">
                <Button
                    onClick={() => setShowProjectDialog(true)}
                    className="btn-primary h-11 px-8 text-[11px] uppercase tracking-[0.1em]"
                >
                    <Plus className="h-4 w-4 mr-2" strokeWidth={2.5} />
                    Deploy Project
                </Button>

                <div className="flex items-center gap-1.5 px-2">
                    <Button
                        onClick={() => setShowTaskDialog(true)}
                        variant="ghost"
                        size="sm"
                        className="h-10 px-4 rounded-full border border-border hover:border-primary/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-all group"
                    >
                        <CheckSquare className="h-3.5 w-3.5 mr-2 opacity-40 group-hover:opacity-100" strokeWidth={1.5} />
                        Task
                    </Button>

                    <Button
                        onClick={() => setShowTimeLogDialog(true)}
                        variant="ghost"
                        size="sm"
                        className="h-10 px-4 rounded-full border border-border hover:border-primary/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-all group"
                    >
                        <Clock className="h-3.5 w-3.5 mr-2 opacity-40 group-hover:opacity-100" strokeWidth={1.5} />
                        Track
                    </Button>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-3 px-6 border-l border-border h-10 ml-2">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                            <div className="h-full w-full rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20" />
                        </div>
                    ))}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80">Active Operations</span>
                    <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-widest">3 Nodes Online</span>
                </div>
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
