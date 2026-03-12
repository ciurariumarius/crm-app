"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"

interface ProjectSheetWrapperProps {
    projects: any[]
    allServices: any[]
    hourlyRate?: number
    children: React.ReactNode
}

// Create a context to manage project sheet state
export const ProjectSheetContext = React.createContext<{
    openProject: (projectId: string, projectData?: any) => void
    closeProject: () => void
    currentProject: any | null
    hourlyRate: number
}>({
    openProject: () => { },
    closeProject: () => { },
    currentProject: null,
    hourlyRate: 0
})

export function ProjectSheetWrapper({ projects, allServices, hourlyRate = 0, children }: ProjectSheetWrapperProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const pendingSyncRef = React.useRef<Record<string, { status?: string; paymentStatus?: string }>>({})

    const openProject = (projectId: string, projectData?: any) => {
        const project = projectData || projects.find(p => p.id === projectId)
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
            const updated = projects.find(p => p.id === selectedProject.id)
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
