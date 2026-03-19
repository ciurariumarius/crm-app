"use client"

import * as React from "react"
import type { SearchPaginationState } from "@/types/search-pagination"

type TasksSearchContextValue = {
    searchTerm: string
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
    searchResultCount: number | null
    setSearchResultCount: React.Dispatch<React.SetStateAction<number | null>>
    isSearching: boolean
    setIsSearching: React.Dispatch<React.SetStateAction<boolean>>
    searchPagination: SearchPaginationState | null
    setSearchPagination: React.Dispatch<React.SetStateAction<SearchPaginationState | null>>
}

const TasksSearchContext = React.createContext<TasksSearchContextValue | null>(null)

export function TasksSearchProvider({
    initialSearch = "",
    children,
}: {
    initialSearch?: string
    children: React.ReactNode
}) {
    const [searchTerm, setSearchTerm] = React.useState(initialSearch)
    const [searchResultCount, setSearchResultCount] = React.useState<number | null>(null)
    const [isSearching, setIsSearching] = React.useState(false)
    const [searchPagination, setSearchPagination] = React.useState<SearchPaginationState | null>(null)

    const value = React.useMemo(
        () => ({
            searchTerm,
            setSearchTerm,
            searchResultCount,
            setSearchResultCount,
            isSearching,
            setIsSearching,
            searchPagination,
            setSearchPagination,
        }),
        [isSearching, searchPagination, searchResultCount, searchTerm]
    )

    return <TasksSearchContext.Provider value={value}>{children}</TasksSearchContext.Provider>
}

export function useTasksSearchContext() {
    return React.useContext(TasksSearchContext)
}
