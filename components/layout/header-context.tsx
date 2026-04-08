"use client"

import React, { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from "react"

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
    isSidebarFocusExpanded: boolean
    setIsSidebarFocusExpanded: (expanded: boolean) => void
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)
const SIDEBAR_COLLAPSED_STORAGE_KEY = "ui:sidebar-collapsed"
const SIDEBAR_COLLAPSED_CHANGE_EVENT = "ui:sidebar-collapsed-change"

const getSidebarCollapsedSnapshot = () => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1"
}

const getServerSidebarCollapsedSnapshot = () => false

const subscribeToSidebarCollapsed = (onStoreChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== SIDEBAR_COLLAPSED_STORAGE_KEY) return
        onStoreChange()
    }

    const handleCustomChange = () => {
        onStoreChange()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleCustomChange)

    return () => {
        window.removeEventListener("storage", handleStorage)
        window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, handleCustomChange)
    }
}

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSidebarFocusExpanded, setIsSidebarFocusExpanded] = useState(false)
    const isSidebarCollapsed = useSyncExternalStore(
        subscribeToSidebarCollapsed,
        getSidebarCollapsedSnapshot,
        getServerSidebarCollapsedSnapshot
    )

    const setIsSidebarCollapsed = useCallback((collapsed: boolean) => {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0")
        window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE_EVENT))
    }, [])

    return (
        <HeaderContext.Provider value={{
            breadcrumbs,
            setBreadcrumbs,
            isMobileMenuOpen,
            setIsMobileMenuOpen,
            isSidebarCollapsed,
            setIsSidebarCollapsed,
            isSidebarFocusExpanded,
            setIsSidebarFocusExpanded,
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
