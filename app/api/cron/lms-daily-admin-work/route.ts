import { apiError, apiInternalError, apiMethodNotAllowed, apiOk } from "@/lib/api-response"
import { getAuditRequestContext, logAuditEvent } from "@/lib/audit"
import { matchesBearerOrHeaderSecret } from "@/lib/http-auth"
import {
  LmsDailyAdminAutomationError,
  runLmsDailyAdminAutomation,
} from "@/lib/lms-work-entries/daily-admin-automation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  return matchesBearerOrHeaderSecret(request, cronSecret, "x-cron-secret")
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return apiError("Unauthorized", 401, { code: "CRON_UNAUTHORIZED" })
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"
  const requestContext = await getAuditRequestContext()
  try {
    const { summary } = await runLmsDailyAdminAutomation({ dryRun })
    for (const result of summary.results.filter((item) => item.status === "failed")) {
      await logAuditEvent({
        action: "LMS_RECURRING_WORK_RULE_FAILED",
        success: false,
        ...requestContext,
        details: `ruleId=${result.ruleId}; code=${result.errorCode}; dryRun=${dryRun}`,
      })
    }
    await logAuditEvent({
      action: dryRun ? "LMS_RECURRING_WORK_DRY_RUN" : "LMS_RECURRING_WORK_COMPLETED",
      success: summary.failedRules === 0,
      ...requestContext,
      details: `date=${summary.date}; rules=${summary.rulesProcessed}; created=${summary.entriesCreated}; adopted=${summary.entriesAdopted}; skipped=${summary.skippedNonWorkingDates}; failed=${summary.failedRules}; alreadyProcessed=${summary.alreadyProcessed}`,
    })
    return apiOk({
      success: summary.failedRules === 0,
      dryRun,
      ...summary,
    }, summary.failedRules > 0 ? 500 : 200)
  } catch (error) {
    const knownError = error instanceof LmsDailyAdminAutomationError ? error : null
    await logAuditEvent({
      action: "LMS_DAILY_ADMIN_WORK_FAILED",
      success: false,
      ...requestContext,
      details: `code=${knownError?.code || "LMS_RECURRING_WORK_UNEXPECTED_ERROR"}; dryRun=${dryRun}`,
    })
    if (knownError) {
      return apiError(knownError.message, knownError.status, { code: knownError.code })
    }
    return apiInternalError(error, "Failed to process LMS recurring work")
  }
}

export async function GET() {
  return apiMethodNotAllowed(["POST"])
}
