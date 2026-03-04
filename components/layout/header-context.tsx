"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"

interface BreadcrumbItem {
    label: string
    href?: string
}

interface HeaderContextType {
    breadcrumbs: BreadcrumbItem[]
    setBreadcrumbs: (items: BreadcrumbItem[]) => void
    isMobileMenuOpen: boolean
    setIsMobileMenuOpen: (open: boolean) => void
    isSidebarCollapsed: boolean
    setIsSidebarCollapsed: (collapsed: boolean) => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    useEffect(() => {
        const stored = window.localStorage.getItem("ui:sidebar-collapsed")
        if (stored === "1") {
            setIsSidebarCollapsed(true)
        }
    }, [])

    useEffect(() => {
        window.localStorage.setItem("ui:sidebar-collapsed", isSidebarCollapsed ? "1" : "0")
    }, [isSidebarCollapsed])

    return (
        <HeaderContext.Provider value={{
            breadcrumbs,
            setBreadcrumbs,
            isMobileMenuOpen,
            setIsMobileMenuOpen,
            isSidebarCollapsed,
            setIsSidebarCollapsed,
        }}>
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
