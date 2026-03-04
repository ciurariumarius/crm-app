"use client"

import * as React from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
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
            if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
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
                    className="w-[92vw] sm:max-w-[860px] 2xl:max-w-[980px] p-0 border-l border-border bg-white/90 backdrop-blur-[12px] shadow-[var(--shadow-drawer)] flex flex-col overflow-hidden rounded-l-[12px]"
                >
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
                            onClose={closeProject}
                            onUpdate={(updated) => {
                                setSelectedProject(updated)
                            }}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </ProjectSheetContext.Provider>
    )
}
