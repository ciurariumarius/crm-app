"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { ServiceStatusBadge } from "@/components/lms-tasks/lms-tasks-badges"

export default function LmsAllocationsPage() {
  const { ready, data } = useLmsTasksData()

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.allocations.length === 0) {
    return <LmsTasksEmptyState />
  }

  const sortedRows = [...data.allocations].sort((a, b) => a.client.localeCompare(b.client))

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader>
        <CardTitle>Allocations Status</CardTitle>
        <CardDescription>Raw allocation table with visual emphasis for inactive/stopped services.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Specialist</TableHead>
              <TableHead>SEO</TableHead>
              <TableHead>GAds</TableHead>
              <TableHead>FAds</TableHead>
              <TableHead>TAds</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const hasRisk = [row.seo, row.gads, row.fads, row.tads].some((status) => status === "Inactive" || status === "Stopped")
              return (
                <TableRow
                  key={`${row.client}-${row.specialist}`}
                  className={hasRisk ? "bg-[color:color-mix(in_srgb,var(--state-warning)_9%,var(--surface-lowest))] hover:bg-[color:color-mix(in_srgb,var(--state-warning)_13%,var(--surface-lowest))]" : undefined}
                >
                  <TableCell className="font-semibold">{row.client}</TableCell>
                  <TableCell>{row.specialist || "Unassigned"}</TableCell>
                  <TableCell><ServiceStatusBadge status={row.seo} /></TableCell>
                  <TableCell><ServiceStatusBadge status={row.gads} /></TableCell>
                  <TableCell><ServiceStatusBadge status={row.fads} /></TableCell>
                  <TableCell><ServiceStatusBadge status={row.tads} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
