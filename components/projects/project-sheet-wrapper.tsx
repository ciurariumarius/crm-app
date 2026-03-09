"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"

interface ProjectSheetWrapperProps {
    projects: any[]
    allServices: any[]
    children: React.ReactNode
}

// Create a context to manage project sheet state
export const ProjectSheetContext = React.createContext<{
    openProject: (projectId: string) => void
    closeProject: () => void
    currentProject: any | null
}>({
    openProject: () => { },
    closeProject: () => { },
    currentProject: null
})

export function ProjectSheetWrapper({ projects, allServices, children }: ProjectSheetWrapperProps) {
    const [selectedProject, setSelectedProject] = React.useState<any>(null)
    const pendingSyncRef = React.useRef<Record<string, { status?: string; paymentStatus?: string }>>({})

    const openProject = (projectId: string) => {
        const project = projects.find(p => p.id === projectId)
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
        <ProjectSheetContext.Provider value={{ openProject, closeProject, currentProject: selectedProject }}>
            {children}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && closeProject()}>
                <SheetContent
                    side="right"
                    showCloseButton={false}
                    className="w-full max-w-[900px] p-0 border-l border-border bg-white/90 backdrop-blur-[12px] shadow-[var(--shadow-drawer)] flex flex-col overflow-hidden rounded-l-[12px]"
                >
                    <SheetTitle className="sr-only">Project details</SheetTitle>
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
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
