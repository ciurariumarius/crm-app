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
import { getProjectById } from "@/lib/actions/projects"
import { Loader2 } from "lucide-react"

interface ProjectSheetWrapperProps {
    projects: Array<{ id: string }>
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
    const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null)
    const [projectLoadError, setProjectLoadError] = React.useState<string | null>(null)
    const [selectedSite, setSelectedSite] = React.useState<Site & { partner?: { id: string; name: string } } | null>(null)
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null)
    const pendingSyncRef = React.useRef<Record<string, { status?: string; paymentStatus?: string }>>({})

    const openProject = React.useCallback((projectId: string) => {
        if (!projectId) return
        setSelectedProjectId(projectId)
        setSelectedProject(null)
        setProjectLoadError(null)

        void getProjectById(projectId).then((result) => {
            if (!result.success || !result.data) {
                setProjectLoadError(result.error || "Failed to load project")
                return
            }
            setSelectedProject(result.data as ProjectWithDetails)
        }).catch(() => {
            setProjectLoadError("Failed to load project")
        })
    }, [])

    const closeProject = () => {
        setSelectedProjectId(null)
        setSelectedProject(null)
        setProjectLoadError(null)
    }

    React.useEffect(() => {
        const openProjectId = searchParams.get("openProject")
        if (!openProjectId) return

        const projectFromUrl = projects.find((entry) => entry.id === openProjectId)
        if (!projectFromUrl) return

        if (selectedProjectId !== projectFromUrl.id) openProject(projectFromUrl.id)

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("openProject")
        const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname
        router.replace(nextUrl, { scroll: false })
    }, [openProject, pathname, projects, router, searchParams, selectedProjectId])

    return (
        <ProjectSheetContext.Provider value={{ openProject, closeProject, currentProject: selectedProject, hourlyRate }}>
            {children}
            <Sheet open={!!selectedProjectId} onOpenChange={(open) => !open && closeProject()}>
                <SheetContent
                    side="right"
                    showCloseButton={false}
                    className={sidePanelClass("default", 0)}
                >
                    <SheetTitle className="sr-only">Project details</SheetTitle>
                    {!selectedProject && !projectLoadError ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" aria-label="Loading project" />
                        </div>
                    ) : null}
                    {projectLoadError ? (
                        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[var(--text-secondary)]">
                            {projectLoadError}
                        </div>
                    ) : null}
                    {selectedProject ? (
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
                    ) : null}
                </SheetContent>
            </Sheet>

            {/* Site detail view if needed */}
            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow", 2)}>
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
                    className={sidePanelClass("default", 1)}
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
