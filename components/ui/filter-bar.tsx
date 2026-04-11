import * as React from "react"
import { cn } from "@/lib/utils"

export function FilterBarShell({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return (
        <div className={cn("rounded-[16px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-apple)]", className)}>
            {children}
        </div>
    )
}

export function FilterBarScroll({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return (
        <div className={cn("overflow-x-auto hidescrollbar", className)}>
            {children}
        </div>
    )
}

export function FilterBarRow({
    className,
    children,
    wrap = false,
}: {
    className?: string
    children: React.ReactNode
    wrap?: boolean
}) {
    return (
        <div className={cn(
            wrap
                ? "flex w-full min-w-0 flex-wrap items-center gap-3 xl:gap-6"
                : "inline-flex min-w-max items-center gap-4 xl:flex xl:w-full xl:min-w-0 xl:items-center xl:gap-6",
            className
        )}>
            {children}
        </div>
    )
}

export function FilterBarGroup({
    className,
    children,
    wrap = false,
}: {
    className?: string
    children: React.ReactNode
    wrap?: boolean
}) {
    return (
        <div
            className={cn(
                wrap ? "flex min-w-0 flex-wrap items-center gap-3 xl:gap-5" : "inline-flex items-center gap-4 xl:gap-5",
                className
            )}
        >
            {children}
        </div>
    )
}

export function FilterBarDivider({
    className,
}: {
    className?: string
}) {
    return <div className={cn("h-6 w-px bg-[var(--line-subtle)]", className)} />
}

export function FilterResultsRow({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return <div className={cn("px-1 flex flex-wrap items-center gap-2", className)}>{children}</div>
}
