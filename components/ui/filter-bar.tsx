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
        <div className={cn("rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm", className)}>
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
}: {
    className?: string
    children: React.ReactNode
}) {
    return (
        <div className={cn("inline-flex min-w-max items-center gap-4 md:flex md:w-full md:min-w-0 md:items-center md:gap-6", className)}>
            {children}
        </div>
    )
}

export function FilterBarGroup({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return <div className={cn("inline-flex items-center gap-4 md:gap-5", className)}>{children}</div>
}

export function FilterBarDivider({
    className,
}: {
    className?: string
}) {
    return <div className={cn("h-6 w-px bg-slate-200", className)} />
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
