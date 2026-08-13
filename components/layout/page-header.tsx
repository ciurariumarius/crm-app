import * as React from "react"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
    title: string
    subtitle?: string
    description?: string
    actions?: React.ReactNode
    className?: string
    titleClassName?: string
}

export function PageHeader({
    title,
    subtitle,
    description,
    actions,
    className,
    titleClassName,
}: PageHeaderProps) {
    const effectiveSubtitle = subtitle ?? description

    return (
        <div className={cn("flex flex-col gap-2 rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-apple)] md:px-6", className)}>
            <div className="flex min-h-10 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <MobileMenuTrigger />
                    <h1 className={cn("page-title data-blade-title", titleClassName)}>{title}</h1>
                </div>
                {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
            {effectiveSubtitle ? <p className="page-subtitle">{effectiveSubtitle}</p> : null}
        </div>
    )
}
