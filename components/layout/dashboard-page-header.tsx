import * as React from "react"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"

type DashboardPageHeaderProps = {
    title: string
    search?: React.ReactNode
    actions?: React.ReactNode
    className?: string
    showMobile?: boolean
    mobileSearch?: React.ReactNode
    mobileActions?: React.ReactNode
}

export function DashboardPageHeader({
    title,
    search,
    actions,
    className,
    showMobile = false,
    mobileSearch,
    mobileActions,
}: DashboardPageHeaderProps) {
    return (
        <>
            {showMobile ? (
                <div className="md:hidden flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <MobileMenuTrigger />
                            <h1 className="ui-text-title text-slate-900">{title}</h1>
                        </div>
                        {mobileActions ?? actions}
                    </div>
                    {mobileSearch ?? search}
                </div>
            ) : null}

            <div className={["hidden md:flex flex-col lg:flex-row lg:items-center gap-4", className].filter(Boolean).join(" ")}>
                <div className="flex items-center gap-3 min-w-[180px]">
                    <MobileMenuTrigger />
                    <h1 className="ui-text-title text-slate-900">{title}</h1>
                </div>

                {search ? <div className="flex-1 min-w-0">{search}</div> : <div className="flex-1 min-w-0" />}

                {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
            </div>
        </>
    )
}
