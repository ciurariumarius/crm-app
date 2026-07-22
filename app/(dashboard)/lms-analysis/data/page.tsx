import { LmsAnalysisDataWorkspace } from "@/components/lms-tasks/lms-analysis-data-workspace"
import { getLmsWorkRecurrencePageData, getLmsWorkTaskOptions } from "@/lib/lms-work-entries/db"

export const dynamic = "force-dynamic"

export default async function LmsAnalysisDataPage() {
  const [workTasks, recurrenceData] = await Promise.all([
    getLmsWorkTaskOptions(),
    getLmsWorkRecurrencePageData(),
  ])
  return <LmsAnalysisDataWorkspace workTasks={workTasks} recurrenceData={recurrenceData} />
}
