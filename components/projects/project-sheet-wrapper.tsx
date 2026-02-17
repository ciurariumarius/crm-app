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
                <SheetContent side="right" className="min-w-full sm:min-w-[600px] md:min-w-[700px] lg:min-w-[800px] p-0 border-l border-border bg-background shadow-2xl">
                    {selectedProject && (
                        <ProjectSheetContent
                            project={selectedProject}
                            allServices={allServices}
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
