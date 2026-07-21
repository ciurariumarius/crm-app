import { LmsAnalysisDataWorkspace } from "@/components/lms-tasks/lms-analysis-data-workspace"
import { resolveLmsDataSection } from "@/lib/lms-work-entries/data-section"
import { getLmsWorkTaskOptions } from "@/lib/lms-work-entries/db"

export const dynamic = "force-dynamic"

export default async function LmsAnalysisDataPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const [params, workTasks] = await Promise.all([searchParams, getLmsWorkTaskOptions()])
  return <LmsAnalysisDataWorkspace workTasks={workTasks} activeSection={resolveLmsDataSection(params.section)} />
}
