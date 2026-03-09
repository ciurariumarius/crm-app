"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { GlobalTimer } from "@/components/layout/global-timer"
import { Toaster } from "@/components/ui/sonner"
import { PWARegister } from "@/components/pwa-register"
import { cn } from "@/lib/utils"
import { useHeader } from "@/components/layout/header-context"

type ShellFrameProps = {
    user?: { name: string | null, username: string, profilePic: string | null }
    children: React.ReactNode
}

export function ShellFrame({ user, children }: ShellFrameProps) {
    const { isSidebarCollapsed } = useHeader()

    return (
        <div className="flex min-h-dvh overflow-hidden bg-background">
            <Sidebar user={user} />
            <div
                className={cn(
                    "flex-1 flex flex-col min-w-0 min-h-dvh overflow-y-auto transition-all duration-300 relative",
                    isSidebarCollapsed ? "md:pl-[88px]" : "md:pl-[220px]"
                )}
            >
                <main className="cockpit-page-enter flex-1 px-4 md:px-8 pt-4 md:pt-8 pb-24 md:pb-8 max-w-full overflow-hidden">
                    {children}
                </main>
            </div>
            <GlobalTimer />
            <Toaster />
            <PWARegister />
        </div>
    )
}
