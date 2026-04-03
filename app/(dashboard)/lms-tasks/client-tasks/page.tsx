"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { buildClientExplorerRows, formatHours } from "@/lib/lms-tasks/analytics"

const PAGE_SIZE = 20

export default function LmsClientTasksPage() {
  const { ready, data } = useLmsTasksData()
  const { start, end } = useLmsDateRange()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const page = Math.max(1, Number(searchParams.get("page") || "1"))

  const rows = React.useMemo(() => buildClientExplorerRows(data.tasks, start, end), [data.tasks, start, end])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE)

  const updatePage = React.useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextPage <= 1) params.delete("page")
      else params.set("page", String(nextPage))
      router.replace(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.tasks.length === 0) {
    return <LmsTasksEmptyState />
  }

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader>
        <CardTitle>Client Tasks</CardTitle>
        <CardDescription>Unique clients in task logs with totals, executants, and latest activity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Total Tasks</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Executants</TableHead>
              <TableHead>Latest Task Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.client}>
                <TableCell className="font-semibold">{row.client}</TableCell>
                <TableCell>{row.totalTasks}</TableCell>
                <TableCell>{formatHours(row.totalMinutes)}</TableCell>
                <TableCell className="max-w-[360px] truncate">{row.executants.join(", ") || "-"}</TableCell>
                <TableCell>{row.latestTaskDate ?? "-"}</TableCell>
              </TableRow>
            ))}
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[var(--text-secondary)]">
                  No client activity in current date window.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-secondary)]">
            Page {safePage} of {totalPages} · {rows.length} clients
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" disabled={safePage <= 1} onClick={() => updatePage(safePage - 1)}>
              Previous
            </Button>
            <Button variant="outline" className="rounded-xl" disabled={safePage >= totalPages} onClick={() => updatePage(safePage + 1)}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
