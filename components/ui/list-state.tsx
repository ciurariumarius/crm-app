import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function ListEmptyState({
    title,
    description,
    className,
    icon,
}: {
    title: string
    description?: string
    className?: string
    icon?: React.ReactNode
}) {
    return (
        <div
            className={cn(
                "rounded-[16px] border border-dashed border-[var(--line-subtle)] bg-[var(--surface-low)] px-6 py-10 text-center",
                className
            )}
        >
            {icon ? (
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[color:color-mix(in_srgb,var(--brand-primary)_18%,var(--line-subtle))] bg-[var(--sidebar-accent)] text-[var(--brand-primary)]">
                    {icon}
                </div>
            ) : null}
            <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{title}</p>
            {description ? <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
        </div>
    )
}

export function ListLoadingState({
    label = "Loading...",
    className,
}: {
    label?: string
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-center gap-2 rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-4 py-6 text-[var(--text-secondary)]",
                className
            )}
        >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ui-text-caption">{label}</span>
        </div>
    )
}

export function ListSkeletonRows({
    rows = 4,
    className,
}: {
    rows?: number
    className?: string
}) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="h-12 animate-pulse rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-low)]"
                />
            ))}
        </div>
    )
}
