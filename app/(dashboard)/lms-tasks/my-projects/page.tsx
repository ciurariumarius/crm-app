"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { ServiceStatusBadge, WorkVolumeBadge } from "@/components/lms-tasks/lms-tasks-badges"
import { buildMyProjectsRows, formatHours, formatRecencyLabel, getExecutantOptions } from "@/lib/lms-tasks/analytics"

export default function LmsMyProjectsPage() {
  const { ready, data } = useLmsTasksData()
  const { start, end } = useLmsDateRange()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const selectedExecutant = searchParams.get("exec") || "all"

  const executantOptions = React.useMemo(() => getExecutantOptions(data.tasks, data.allocations), [data.tasks, data.allocations])
  const rows = React.useMemo(
    () => buildMyProjectsRows(data.tasks, data.allocations, selectedExecutant, start, end),
    [data.tasks, data.allocations, selectedExecutant, start, end]
  )

  const handleExecutantChange = React.useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (!value || value === "all") next.delete("exec")
      else next.set("exec", value)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams]
  )

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.tasks.length === 0 && data.allocations.length === 0) {
    return <LmsTasksEmptyState />
  }

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader className="space-y-3">
        <div>
          <CardTitle>My Projects</CardTitle>
          <CardDescription>Joined tasks + allocations by client for the selected specialist.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Executant</span>
            <select
              value={selectedExecutant}
              onChange={(event) => handleExecutantChange(event.target.value)}
              className="h-10 min-w-[220px] rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-sm"
            >
              <option value="all">All</option>
              {executantOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            Period: {start} to {end}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Work Volume</TableHead>
              <TableHead>Last Task</TableHead>
              <TableHead>Recency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.client}>
                <TableCell className="font-semibold">{row.client}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">SEO</span>
                    <ServiceStatusBadge status={row.services.seo} />
                    <span className="text-xs font-semibold text-[var(--text-muted)]">GAds</span>
                    <ServiceStatusBadge status={row.services.gads} />
                    <span className="text-xs font-semibold text-[var(--text-muted)]">FAds</span>
                    <ServiceStatusBadge status={row.services.fads} />
                    <span className="text-xs font-semibold text-[var(--text-muted)]">TAds</span>
                    <ServiceStatusBadge status={row.services.tads} />
                  </div>
                </TableCell>
                <TableCell>{formatHours(row.totalMinutes)}</TableCell>
                <TableCell>
                  <WorkVolumeBadge status={row.workVolumeStatus} />
                </TableCell>
                <TableCell>{row.lastTaskDate ?? "-"}</TableCell>
                <TableCell>{formatRecencyLabel(row.lastTaskDate)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--text-secondary)]">
                  No clients found for this specialist and range.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
