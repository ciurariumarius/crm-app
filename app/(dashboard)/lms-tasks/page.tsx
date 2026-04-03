"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { useLmsDateRange } from "@/components/lms-tasks/use-lms-date-range"
import { LmsTasksEmptyState } from "@/components/lms-tasks/lms-tasks-empty-state"
import { buildMonthlyUtilization, buildTeamWorkload, buildTopStats, formatHours } from "@/lib/lms-tasks/analytics"

const utilizationChartConfig = {
  loggedHours: { label: "Logged Hours", color: "hsl(var(--primary))" },
  capacityHours: { label: "Capacity Hours", color: "hsl(220 15% 72%)" },
} satisfies ChartConfig

export default function LmsTasksDashboardPage() {
  const { ready, data } = useLmsTasksData()
  const dateRange = useLmsDateRange()

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  if (data.tasks.length === 0 && data.allocations.length === 0) {
    return <LmsTasksEmptyState />
  }

  const topStats = buildTopStats(data.tasks, data.allocations)
  const monthlyRows = buildMonthlyUtilization(data.tasks, dateRange.start, dateRange.end)
  const teamRows = buildTeamWorkload(data.tasks, dateRange.start, dateRange.end)
  const chartRows = monthlyRows.map((row) => ({
    monthLabel: row.monthLabel,
    loggedHours: Number((row.loggedMinutes / 60).toFixed(1)),
    capacityHours: Number((row.capacityMinutes / 60).toFixed(1)),
    utilizationPercent: row.utilizationPercent,
  }))

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Total Projects</CardDescription>
            <CardTitle className="text-2xl">{topStats.totalProjects}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Active SEO</CardDescription>
            <CardTitle className="text-2xl">{topStats.activeServices.seo}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Active GAds</CardDescription>
            <CardTitle className="text-2xl">{topStats.activeServices.gads}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Active FAds</CardDescription>
            <CardTitle className="text-2xl">{topStats.activeServices.fads}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-[var(--line-subtle)]">
          <CardHeader className="pb-2">
            <CardDescription>Active TAds</CardDescription>
            <CardTitle className="text-2xl">{topStats.activeServices.tads}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Monthly Utilization</CardTitle>
          <CardDescription>Logged hours vs monthly working-capacity hours for the selected range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartContainer config={utilizationChartConfig} className="h-[320px] w-full">
            <LineChart data={chartRows} margin={{ left: 10, right: 10, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
              <Line type="monotone" dataKey="capacityHours" stroke="var(--color-capacityHours)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="loggedHours" stroke="var(--color-loggedHours)" strokeWidth={2.8} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>

          <ChartContainer config={utilizationChartConfig} className="h-[180px] w-full">
            <BarChart data={chartRows}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="utilizationPercent" fill="var(--color-loggedHours)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Team Workload</CardTitle>
          <CardDescription>Hours logged, individual capacity %, and internal work %.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Executant</TableHead>
                <TableHead>Hours Logged</TableHead>
                <TableHead>Capacity %</TableHead>
                <TableHead>Internal %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamRows.map((row) => (
                <TableRow key={row.executant}>
                  <TableCell className="font-semibold">{row.executant}</TableCell>
                  <TableCell>{formatHours(row.totalMinutes)}</TableCell>
                  <TableCell>{row.capacityPercent.toFixed(1)}%</TableCell>
                  <TableCell>{row.internalPercent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {teamRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-[var(--text-secondary)]">
                    No rows for current date window.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
