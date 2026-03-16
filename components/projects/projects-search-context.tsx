"use client"

import * as React from "react"

type ProjectsSearchContextValue = {
    searchTerm: string
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
}

const ProjectsSearchContext = React.createContext<ProjectsSearchContextValue | null>(null)

export function ProjectsSearchProvider({
    initialSearch = "",
    children,
}: {
    initialSearch?: string
    children: React.ReactNode
}) {
    const [searchTerm, setSearchTerm] = React.useState(initialSearch)

    const value = React.useMemo(
        () => ({ searchTerm, setSearchTerm }),
        [searchTerm]
    )

    return <ProjectsSearchContext.Provider value={value}>{children}</ProjectsSearchContext.Provider>
}

export function useProjectsSearchContext() {
    return React.useContext(ProjectsSearchContext)
}

