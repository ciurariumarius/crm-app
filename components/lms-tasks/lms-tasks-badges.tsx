"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServiceStatus, WorkVolumeStatus } from "@/lib/lms-tasks/types"

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
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
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
        status === "High" && "border-orange-300 bg-orange-50 text-orange-700",
        status === "Optimal" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        status === "Medium" && "border-cyan-300 bg-cyan-50 text-cyan-700",
        (status === "Low" || status === "No Work") && "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]",
        status === "Extra" && "border-violet-300 bg-violet-50 text-violet-700"
      )}
    >
      {status}
    </Badge>
  )
}
