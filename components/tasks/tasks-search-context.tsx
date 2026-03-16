"use client"

import * as React from "react"

type TasksSearchContextValue = {
    searchTerm: string
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>
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

    const value = React.useMemo(
        () => ({ searchTerm, setSearchTerm }),
        [searchTerm]
    )

    return <TasksSearchContext.Provider value={value}>{children}</TasksSearchContext.Provider>
}

export function useTasksSearchContext() {
    return React.useContext(TasksSearchContext)
}

