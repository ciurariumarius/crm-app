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
import { useResponsiveProfile } from "@/hooks/use-responsive-profile"
type ShellFrameProps = {
    user?: { name: string | null, username: string, profilePic: string | null }
    children: React.ReactNode
}

export function ShellFrame({
    user,
    children,
}: ShellFrameProps) {
    const { isSidebarCollapsed } = useHeader()
    const pathname = usePathname()
    const responsiveProfile = useResponsiveProfile()
    const isDesktopCollapsed = isSidebarCollapsed

    React.useEffect(() => {
        window.scrollTo({ top: 0, left: 0 })
    }, [pathname])

    return (
        <div className="min-h-dvh bg-[var(--bg-canvas)] md:p-2 xl:p-4">
            <div className="relative flex min-h-dvh bg-[var(--background)] md:min-h-[calc(100dvh-1rem)] md:rounded-[14px] md:border md:border-[color:color-mix(in_srgb,var(--line-subtle)_84%,transparent)] md:shadow-[var(--shadow-shell)] xl:min-h-[calc(100dvh-2rem)] xl:rounded-[20px]">
                <Sidebar user={user} />
                <div
                    data-responsive-profile={responsiveProfile}
                    className={cn(
                        "relative flex min-w-0 flex-1 flex-col transition-[padding] duration-300",
                        isDesktopCollapsed ? "md:pl-[80px]" : "md:pl-[232px]"
                    )}
                >
                    <main className="cockpit-page-enter min-h-full max-w-full flex-1 overflow-x-clip px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-4 md:px-5 md:pb-7 md:pt-5 xl:px-7 xl:pb-8 xl:pt-7 2xl:px-8">
                        {children}
                    </main>
                </div>
            </div>
            <MobileBottomNav />
            <GlobalTimer />
            <Toaster />
            <PWARegister />
        </div>
    )
}
