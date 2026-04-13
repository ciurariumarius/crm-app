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
    tabletSearch?: React.ReactNode
    tabletActions?: React.ReactNode
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
    tabletSearch,
    tabletActions,
}: DashboardPageHeaderProps) {
    const duplicateNode = (node: React.ReactNode) => {
        if (!React.isValidElement(node)) return node
        return React.cloneElement(node)
    }

    const resolvedMobileActions = mobileActions ?? duplicateNode(actions)
    const resolvedMobileSearch = mobileSearch ?? duplicateNode(search)
    const resolvedTabletActions = tabletActions ?? duplicateNode(actions)
    const resolvedTabletSearch = tabletSearch ?? duplicateNode(search)

    return (
        <>
            {showMobile ? (
                <div className="flex flex-col gap-3 md:hidden">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <MobileMenuTrigger />
                            <div className="min-w-0">
                                {eyebrow ? (
                                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400/90">
                                        {eyebrow}
                                    </p>
                                ) : null}
                                <h1 className="ui-text-title tracking-tight text-slate-900">{title}</h1>
                                {subtitle ? (
                                    <p className="mt-1 max-w-xl text-[13px] font-medium leading-5 text-slate-500">
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

            <div className={["hidden items-center gap-3 md:grid md:grid-cols-[minmax(180px,1fr)_minmax(320px,640px)_minmax(180px,1fr)] xl:hidden", className].filter(Boolean).join(" ")}>
                <div className="min-w-0 justify-self-start">
                    <div className="min-w-0">
                        {eyebrow ? (
                            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400/90">
                                {eyebrow}
                            </p>
                        ) : null}
                        <h1 className="ui-text-title tracking-tight text-slate-900">{title}</h1>
                    </div>
                </div>

                {resolvedTabletSearch ? <div className="w-full justify-self-center">{resolvedTabletSearch}</div> : <div className="w-full" />}

                {resolvedTabletActions ? <div className="min-w-0 justify-self-end flex items-center justify-end gap-2.5">{resolvedTabletActions}</div> : <div className="min-w-0" />}
            </div>

            <div className={["hidden gap-4 xl:grid xl:grid-cols-[minmax(240px,1fr)_minmax(360px,640px)_minmax(240px,1fr)] xl:items-center", className].filter(Boolean).join(" ")}>
                <div className="min-w-0 justify-self-start">
                    <div className="flex items-start gap-3">
                        <MobileMenuTrigger />
                        <div className="min-w-0 pt-0.5">
                            {eyebrow ? (
                                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400/90">
                                    {eyebrow}
                                </p>
                            ) : null}
                            <h1 className="ui-text-title tracking-tight text-slate-900">{title}</h1>
                            {subtitle ? (
                                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                {search ? <div className="w-full justify-self-center">{search}</div> : <div className="w-full" />}

                {actions ? <div className="min-w-0 justify-self-end flex items-center justify-end gap-3">{actions}</div> : <div className="min-w-0" />}
            </div>
        </>
    )
}
