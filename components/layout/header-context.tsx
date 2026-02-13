"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

interface BreadcrumbItem {
    label: string
    href?: string
}

interface HeaderContextType {
    breadcrumbs: BreadcrumbItem[]
    setBreadcrumbs: (items: BreadcrumbItem[]) => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])

    return (
        <HeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
            {children}
        </HeaderContext.Provider>
    )
}

export function useHeader() {
    const context = useContext(HeaderContext)
    if (context === undefined) {
        throw new Error("useHeader must be used within a HeaderProvider")
    }
    return context
}
