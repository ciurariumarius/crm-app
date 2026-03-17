"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import type { ProjectWithDetails } from "@/types"
import type { Service } from "@prisma/client"

interface ProjectSheetWrapperProps {
    projects: ProjectWithDetails[]
    allServices: Service[]
    hourlyRate?: number
    children: React.ReactNode
}

// Create a context to manage project sheet state
export const ProjectSheetContext = React.createContext<{
    openProject: (projectId: string, projectData?: ProjectWithDetails) => void
    closeProject: () => void
    currentProject: ProjectWithDetails | null
    hourlyRate: number
}>({
    openProject: () => { },
    closeProject: () => { },
    currentProject: null,
    hourlyRate: 0
})

export function ProjectSheetWrapper({ projects, allServices, hourlyRate = 0, children }: ProjectSheetWrapperProps) {
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const pendingSyncRef = React.useRef<Record<string, { status?: string; paymentStatus?: string }>>({})

    const openProject = (projectId: string, projectData?: ProjectWithDetails) => {
        const project = projectData || projects.find((entry) => entry.id === projectId)
        if (project) {
            setSelectedProject(project)
        }
    }

    const closeProject = () => {
        setSelectedProject(null)
    }

    // Update selected project if it changes in the list (e.g. after editing)
    React.useEffect(() => {
        if (selectedProject) {
            const updated = projects.find((entry) => entry.id === selectedProject.id)
            if (!updated) return

            const pending = pendingSyncRef.current[selectedProject.id]
            if (pending) {
                const statusIsStale = pending.status !== undefined && updated.status !== pending.status
                const paymentIsStale = pending.paymentStatus !== undefined && updated.paymentStatus !== pending.paymentStatus

                // Ignore stale list snapshots right after a local edit.
                if (statusIsStale || paymentIsStale) {
                    return
                }

                delete pendingSyncRef.current[selectedProject.id]
            }

            if (JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
                setSelectedProject(updated)
            }
        }
    }, [projects, selectedProject])

    return (
        <ProjectSheetContext.Provider value={{ openProject, closeProject, currentProject: selectedProject, hourlyRate }}>
            {children}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && closeProject()}>
                <SheetContent
                    side="right"
                    showCloseButton={false}
                    className="w-screen max-w-none p-0 border-l border-border bg-white shadow-[var(--shadow-drawer)] flex flex-col overflow-hidden sm:w-full sm:max-w-[1020px] sm:rounded-l-[12px]"
                >
                    <SheetTitle className="sr-only">Project details</SheetTitle>
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            hourlyRate={hourlyRate}
                            onClose={closeProject}
                            onUpdate={(updated) => {
                                setSelectedProject(updated)
                                if (updated?.id) {
                                    pendingSyncRef.current[updated.id] = {
                                        status: updated.status,
                                        paymentStatus: updated.paymentStatus,
                                    }
                                }
                            }}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </ProjectSheetContext.Provider>
    )
}
