"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type DurationValueProps = {
  minutes: number
  className?: string
  numberClassName?: string
  unitClassName?: string
}

export function DurationValue({
  minutes,
  className,
  numberClassName,
  unitClassName,
}: DurationValueProps) {
  const totalMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)}>
      {hours > 0 ? (
        <>
          <span className="inline-flex items-baseline">
            <span className={cn("font-semibold text-[var(--text-primary)]", numberClassName)}>{hours}</span>
            <span className={cn("font-semibold text-[var(--text-muted)]", unitClassName)}>h</span>
          </span>
          {remainingMinutes > 0 ? (
            <span className="ml-2 inline-flex items-baseline">
              <span className={cn("font-semibold text-[var(--text-primary)]", numberClassName)}>{remainingMinutes}</span>
              <span className={cn("font-semibold text-[var(--text-muted)]", unitClassName)}>m</span>
            </span>
          ) : null}
        </>
      ) : (
        <span className="inline-flex items-baseline">
          <span className={cn("font-semibold text-[var(--text-primary)]", numberClassName)}>{totalMinutes}</span>
          <span className={cn("font-semibold text-[var(--text-muted)]", unitClassName)}>m</span>
        </span>
      )}
    </span>
  )
}
