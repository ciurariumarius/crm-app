"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function getDomainInitials(domain: string | null | undefined) {
    const normalized = (domain || "").trim().replace(/^https?:\/\//, "").split("/")[0]
    if (!normalized) return "??"
    return (normalized.split(".")[0] || normalized).slice(0, 2).toUpperCase()
}

export function DomainFavicon({
    siteId,
    domain,
    faviconHash,
    className,
    imageClassName,
}: {
    siteId: string
    domain: string | null | undefined
    faviconHash?: string | null
    className?: string
    imageClassName?: string
}) {
    const [failed, setFailed] = React.useState(false)

    React.useEffect(() => setFailed(false), [faviconHash, siteId])

    return (
        <span className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)]",
            className
        )}>
            {faviconHash && !failed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/sites/${siteId}/favicon?v=${faviconHash}`}
                    alt=""
                    className={cn("h-7 w-7 rounded-md object-contain", imageClassName)}
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]">
                    {getDomainInitials(domain)}
                </span>
            )}
        </span>
    )
}
