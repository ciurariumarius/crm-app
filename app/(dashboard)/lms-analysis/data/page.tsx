import { LmsAnalysisDataWorkspace } from "@/components/lms-tasks/lms-analysis-data-workspace"
import { getLmsWorkTaskOptions } from "@/lib/lms-work-entries/db"

export const dynamic = "force-dynamic"

export default async function LmsAnalysisDataPage() {
  const workTasks = await getLmsWorkTaskOptions()
  return <LmsAnalysisDataWorkspace workTasks={workTasks} />
}
