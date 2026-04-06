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
                "rounded-[24px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.76),rgba(241,245,249,0.5))] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
                className
            )}
        >
            {icon ? (
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/90 bg-white/95 text-slate-400 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                    {icon}
                </div>
            ) : null}
            <p className="text-base font-semibold tracking-tight text-slate-800">{title}</p>
            {description ? <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
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
                "flex items-center justify-center gap-2 rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.84))] px-4 py-6 text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.025)]",
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
                    className="h-12 animate-pulse rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.84))]"
                />
            ))}
        </div>
    )
}
