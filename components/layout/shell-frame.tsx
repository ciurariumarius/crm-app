"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { GlobalTimer } from "@/components/layout/global-timer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { Toaster } from "@/components/ui/sonner"
import { PWARegister } from "@/components/pwa-register"
import { cn } from "@/lib/utils"
import { useHeader } from "@/components/layout/header-context"
import type { Service } from "@prisma/client"
import type { PartnerWithSites } from "@/types"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"

type ShellFrameProps = {
    user?: { name: string | null, username: string, profilePic: string | null }
    quickActionPartners: PartnerWithSites[]
    quickActionServices: Service[]
    quickActionProjects: TaskDialogProject[]
    children: React.ReactNode
}

export function ShellFrame({
    user,
    quickActionPartners,
    quickActionServices,
    quickActionProjects,
    children,
}: ShellFrameProps) {
    const { isSidebarCollapsed, isSidebarFocusExpanded } = useHeader()
    const pathname = usePathname()
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
    const isDesktopCollapsed = isSidebarCollapsed && !isSidebarFocusExpanded

    React.useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return
        container.scrollTo({ top: 0, left: 0 })
    }, [pathname])

    return (
        <div className="flex min-h-dvh overflow-hidden bg-[var(--background)]">
            <Sidebar user={user} />
            <div
                id="app-scroll-container"
                ref={scrollContainerRef}
                className={cn(
                    "flex-1 flex flex-col min-w-0 min-h-dvh overflow-y-auto transition-all duration-300 relative",
                    isDesktopCollapsed ? "md:pl-[92px]" : "md:pl-[236px]"
                )}
            >
                <main className="cockpit-page-enter flex-1 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-8 max-w-full overflow-hidden">
                    {children}
                </main>
            </div>
            <MobileBottomNav
                quickActionPartners={quickActionPartners}
                quickActionServices={quickActionServices}
                quickActionProjects={quickActionProjects}
            />
            <GlobalTimer />
            <Toaster />
            <PWARegister />
        </div>
    )
}
