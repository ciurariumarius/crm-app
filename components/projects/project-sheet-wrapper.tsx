"use client"

import * as React from "react"
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

            {/* We could use a Sheet component here directly or use the Sheet primitive from radix if we want more control,
                but reusing the one from ui/sheet which is likely tailored. 
                However, to make it work globally we need the Sheet component.
            */}
        </ProjectSheetContext.Provider>
    )
}
