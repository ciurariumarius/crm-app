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
        <div className={cn("rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center", className)}>
            {icon ? <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">{icon}</div> : null}
            <p className="text-base font-semibold text-slate-800">{title}</p>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
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
        <div className={cn("flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-6 text-slate-500", className)}>
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
                <div key={index} className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white/70" />
            ))}
        </div>
    )
}
