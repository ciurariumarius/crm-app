import { apiError, apiInternalError, apiMethodNotAllowed, apiOk } from "@/lib/api-response"
import { matchesBearerOrHeaderSecret } from "@/lib/http-auth"
import { syncTickTick } from "@/lib/integrations/ticktick/sync"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

function isAuthorized(request: Request) {
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) return false
    return matchesBearerOrHeaderSecret(request, cronSecret, "x-cron-secret")
}

export async function POST(request: Request) {
    if (!isAuthorized(request)) {
        return apiError("Unauthorized", 401, { code: "UNAUTHORIZED" })
    }

    try {
        const result = await syncTickTick({ manual: false })
        logger.info("[cron-ticktick-sync] Sync executed", { ...result })
        return apiOk(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Sync error"
        logger.error("[cron-ticktick-sync] Sync execution failed", { error: message })
        return apiInternalError(message)
    }
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return apiError("Unauthorized", 401, { code: "UNAUTHORIZED" })
    }

    try {
        const result = await syncTickTick({ manual: false })
        return apiOk(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : "Sync error"
        return apiInternalError(message)
    }
}

export async function HEAD() {
    return apiMethodNotAllowed(["GET", "POST"])
}
