import * as React from "react"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"

type DashboardPageHeaderProps = {
    title: string
    subtitle?: string
    eyebrow?: string
    search?: React.ReactNode
    actions?: React.ReactNode
    className?: string
    showMobile?: boolean
    mobileSearch?: React.ReactNode
    mobileActions?: React.ReactNode
}

export function DashboardPageHeader({
    title,
    subtitle,
    eyebrow,
    search,
    actions,
    className,
    showMobile = false,
    mobileSearch,
    mobileActions,
}: DashboardPageHeaderProps) {
    const duplicateNode = (node: React.ReactNode) => {
        if (!React.isValidElement(node)) return node
        return React.cloneElement(node)
    }

    const resolvedMobileActions = mobileActions ?? duplicateNode(actions)
    const resolvedMobileSearch = mobileSearch ?? duplicateNode(search)

    return (
        <>
            {showMobile ? (
                <div className="md:hidden flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <MobileMenuTrigger />
                            <div className="min-w-0">
                                {eyebrow ? (
                                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        {eyebrow}
                                    </p>
                                ) : null}
                                <h1 className="ui-text-title text-slate-900">{title}</h1>
                                {subtitle ? (
                                    <p className="mt-1 text-[13px] font-medium text-slate-500">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        {resolvedMobileActions}
                    </div>
                    {resolvedMobileSearch}
                </div>
            ) : null}

            <div className={["hidden md:flex flex-col lg:flex-row lg:items-center gap-4", className].filter(Boolean).join(" ")}>
                <div className="min-w-[220px]">
                    <div className="flex items-center gap-3">
                        <MobileMenuTrigger />
                        <div className="min-w-0">
                            {eyebrow ? (
                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    {eyebrow}
                                </p>
                            ) : null}
                            <h1 className="ui-text-title text-slate-900">{title}</h1>
                            {subtitle ? (
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                {search ? <div className="flex-1 min-w-0">{search}</div> : <div className="flex-1 min-w-0" />}

                {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
            </div>
        </>
    )
}
