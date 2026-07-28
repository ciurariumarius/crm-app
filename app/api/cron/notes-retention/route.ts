import { apiError, apiInternalError, apiMethodNotAllowed, apiOk } from "@/lib/api-response"
import { getAuditRequestContext, logAuditEvent } from "@/lib/audit"
import { matchesBearerOrHeaderSecret } from "@/lib/http-auth"
import { runDeletedNotesRetention } from "@/lib/notes/retention.server"

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
    const summary = await runDeletedNotesRetention({ dryRun })
    await logAuditEvent({
      action: dryRun ? "NOTES_RETENTION_DRY_RUN" : "NOTES_RETENTION_COMPLETED",
      success: true,
      ...requestContext,
      details: `cutoff=${summary.cutoff}; candidates=${summary.candidateCount}; deleted=${summary.deletedCount}`,
    })
    return apiOk({ success: true, ...summary })
  } catch (error) {
    await logAuditEvent({
      action: "NOTES_RETENTION_FAILED",
      success: false,
      ...requestContext,
      details: "code=NOTES_RETENTION_FAILED",
    })
    return apiInternalError(error, "Failed to purge deleted notes")
  }
}

export async function GET() {
  return apiMethodNotAllowed(["POST"])
}
