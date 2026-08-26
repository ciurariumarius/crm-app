"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { GlobalTimer } from "@/components/layout/global-timer"
import { PWARegister } from "@/components/pwa-register"
import { IosInstallHint } from "@/components/layout/ios-install-hint"
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
    const isNotesPage = pathname === "/notes"

    React.useEffect(() => {
        window.scrollTo({ top: 0, left: 0 })
    }, [pathname])

    return (
        <div
            className={cn(
                "bg-[var(--bg-canvas)] md:p-2 xl:p-4",
                isNotesPage ? "h-dvh overflow-hidden" : "min-h-dvh"
            )}
        >
            <div
                className={cn(
                    "relative flex bg-[var(--background)] md:rounded-[14px] md:border md:border-[color:color-mix(in_srgb,var(--line-subtle)_84%,transparent)] md:shadow-[var(--shadow-shell)] xl:rounded-[20px]",
                    isNotesPage
                        ? "h-full min-h-0 overflow-hidden"
                        : "min-h-dvh md:min-h-[calc(100dvh-1rem)] xl:min-h-[calc(100dvh-2rem)]"
                )}
            >
                <Sidebar user={user} />
                <div
                    data-responsive-profile={responsiveProfile}
                    className={cn(
                        "relative flex min-w-0 flex-1 flex-col transition-[padding] duration-300",
                        isNotesPage && "h-full min-h-0 overflow-hidden",
                        isDesktopCollapsed ? "md:pl-[80px]" : "md:pl-[232px]"
                    )}
                >
                    <main
                        className={cn(
                            "cockpit-page-enter max-w-full flex-1 overflow-x-clip",
                            isNotesPage
                                ? "h-full min-h-0 overflow-hidden p-0"
                                : "min-h-full px-4 pb-6 pt-4 md:px-5 md:pb-7 md:pt-5 xl:px-7 xl:pb-8 xl:pt-7 2xl:px-8"
                        )}
                    >
                        {children}
                    </main>
                </div>
            </div>
            <GlobalTimer />
            <IosInstallHint />
            <PWARegister />
        </div>
    )
}
