import { detectLmsDatePresetId, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { getLmsWorkLogPageData } from "@/lib/lms-work-entries/db"
import { normalizeLmsWorkDateFilter, normalizeLmsWorkExportStatus } from "@/lib/lms-work-entries/filters"
import { normalizeLmsWorkLogPageSize } from "@/lib/lms-work-entries/pagination"
import { LmsWorkLogWorkspace } from "@/components/lms-work-entries/lms-work-log-workspace"

export const dynamic = "force-dynamic"

export default async function LmsWorkLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string
    from?: string
    to?: string
    client?: string
    task?: string
    date?: string
    exportStatus?: string
    page?: string
    pageSize?: string
  }>
}) {
  const params = await searchParams
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
  const pageSize = normalizeLmsWorkLogPageSize(params.pageSize)
  const hasExplicitRange = Boolean(params.from || params.to)
  const preset = resolveLmsDatePreset(params.period || "all")
  const from = hasExplicitRange ? params.from || null : preset.from
  const to = hasExplicitRange ? params.to || null : preset.to
  const activePeriod = detectLmsDatePresetId(from, to, params.period)
  const data = await getLmsWorkLogPageData({
    from,
    to,
    clientId: params.client,
    taskId: params.task,
    workDate: normalizeLmsWorkDateFilter(params.date, from, to),
    exportStatus: normalizeLmsWorkExportStatus(params.exportStatus),
    page: requestedPage,
    pageSize,
  })

  return <LmsWorkLogWorkspace data={data} activePeriod={activePeriod} />
}
