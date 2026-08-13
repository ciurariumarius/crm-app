"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServiceStatus, WorkVolumeStatus } from "@/lib/lms-tasks/types"

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em]",
        status === "Active" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        status === "Inactive" && "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]",
        status === "Stopped" && "border-rose-300 bg-rose-50 text-rose-700",
        status === "-" && "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)]"
      )}
    >
      {status}
    </Badge>
  )
}

export function WorkVolumeBadge({ status }: { status: WorkVolumeStatus }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em]",
        status === "High" && "border-orange-300 bg-orange-50 text-orange-700",
        status === "Optimal" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        status === "Medium" && "border-[color:color-mix(in_srgb,var(--brand-primary)_28%,var(--line-subtle))] bg-[var(--sidebar-accent)] text-[var(--brand-primary-strong)]",
        (status === "Low" || status === "No Work") && "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]",
        status === "Extra" && "border-[color:color-mix(in_srgb,var(--state-review)_28%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--state-review)_10%,var(--surface-lowest))] text-[var(--state-review)]"
      )}
    >
      {status}
    </Badge>
  )
}
