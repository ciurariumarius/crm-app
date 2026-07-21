import { detectLmsDatePresetId, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { getLmsWorkLogPageData } from "@/lib/lms-work-entries/db"
import { LmsWorkLogWorkspace } from "@/components/lms-work-entries/lms-work-log-workspace"

export const dynamic = "force-dynamic"

export default async function LmsWorkLogPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; page?: string }>
}) {
  const params = await searchParams
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
  const hasExplicitRange = Boolean(params.from || params.to)
  const preset = resolveLmsDatePreset(params.period || "this-month")
  const from = hasExplicitRange ? params.from || null : preset.from
  const to = hasExplicitRange ? params.to || null : preset.to
  const activePeriod = detectLmsDatePresetId(from, to, params.period)
  const data = await getLmsWorkLogPageData({ from, to, page: requestedPage })

  return <LmsWorkLogWorkspace data={data} activePeriod={activePeriod} />
}

