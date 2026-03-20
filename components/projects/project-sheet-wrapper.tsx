"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ProjectSheetContent } from "@/components/projects/project-sheet-content"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { PartnerSheetContent } from "@/components/vault/partner-sheet-content"
import type { ProjectWithDetails } from "@/types"
import type { Service, Site } from "@prisma/client"
import { sidePanelClass } from "@/lib/ui/side-panels"

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
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [selectedProject, setSelectedProject] = React.useState<ProjectWithDetails | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<Site & { partner?: { id: string; name: string } } | null>(null)
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null)
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

    React.useEffect(() => {
        const openProjectId = searchParams.get("openProject")
        if (!openProjectId) return

        const projectFromUrl = projects.find((entry) => entry.id === openProjectId)
        if (!projectFromUrl) return

        setSelectedProject((prev) => (prev?.id === projectFromUrl.id ? prev : projectFromUrl))

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("openProject")
        const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname
        router.replace(nextUrl, { scroll: false })
    }, [pathname, projects, router, searchParams])

    return (
        <ProjectSheetContext.Provider value={{ openProject, closeProject, currentProject: selectedProject, hourlyRate }}>
            {children}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && closeProject()}>
                <SheetContent
                    side="right"
                    showCloseButton={false}
                    className={sidePanelClass("wide")}
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
                            onOpenSite={(site) => setSelectedSite(site)}
                            onOpenPartner={(partnerId) => setSelectedPartnerId(partnerId)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow")}>
                    <SheetTitle className="sr-only">Site Details</SheetTitle>
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))}
                            onClose={() => setSelectedSite(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Partner detail view if needed */}
            <Sheet open={!!selectedPartnerId} onOpenChange={(open) => !open && setSelectedPartnerId(null)}>
                <SheetContent 
                    side="right"
                    showCloseButton={false}
                    className={sidePanelClass("wide")}
                >
                    <SheetTitle className="sr-only">Partner Details</SheetTitle>
                    {selectedPartnerId && (
                        <PartnerSheetContent 
                            partnerId={selectedPartnerId} 
                            onClose={() => setSelectedPartnerId(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </ProjectSheetContext.Provider>
    )
}
