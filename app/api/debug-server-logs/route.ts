import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { apiError, apiRouteError } from "@/lib/api-response"
import { matchesBearerOrHeaderSecret } from "@/lib/http-auth"

const DEBUG_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Robots-Tag": "noindex, nofollow",
}

const DEFAULT_OUT_LOG_PATH = "/home/populatia-crm/.pm2/logs/pixelist-crm-out.log"
const DEFAULT_ERR_LOG_PATH = "/home/populatia-crm/.pm2/logs/pixelist-crm-error.log"
const DEFAULT_TAIL_CHARS = 10_000

function resolveTailSize() {
    const parsed = Number(process.env.DEBUG_API_LOG_TAIL_CHARS || DEFAULT_TAIL_CHARS)
    if (!Number.isFinite(parsed)) return DEFAULT_TAIL_CHARS
    // Keep upper bound to avoid memory spikes on accidental huge env values.
    return Math.max(1_000, Math.min(Math.floor(parsed), 200_000))
}

async function readTail(filePath: string, tailChars: number) {
    try {
        const contents = await readFile(filePath, "utf-8")
        return contents.slice(-tailChars)
    } catch {
        return ""
    }
}

function isAuthorized(request: Request) {
    const allowInProduction = process.env.DEBUG_API_ALLOW_PRODUCTION === "true"
    if (process.env.NODE_ENV === "production" && !allowInProduction) return false
    if (process.env.DEBUG_API_ENABLED !== "true") return false
    const secret = process.env.DEBUG_API_SECRET?.trim()
    if (!secret) return false
    return matchesBearerOrHeaderSecret(request, secret, "x-debug-secret")
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return apiError("Not found", 404, { code: "DEBUG_UNAVAILABLE", headers: DEBUG_HEADERS })
    }

    try {
        const outPath = process.env.DEBUG_API_OUT_LOG_PATH || DEFAULT_OUT_LOG_PATH
        const errPath = process.env.DEBUG_API_ERR_LOG_PATH || DEFAULT_ERR_LOG_PATH
        const tailChars = resolveTailSize()
        const [outLogs, errLogs] = await Promise.all([
            readTail(outPath, tailChars),
            readTail(errPath, tailChars),
        ])

        return NextResponse.json(
            { outLogs, errLogs },
            { headers: DEBUG_HEADERS }
        )
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Not found",
            unauthorizedCode: "DEBUG_UNAUTHORIZED",
            fallbackMessage: "Failed to read debug logs",
            fallbackCode: "DEBUG_LOG_READ_FAILED",
            headers: DEBUG_HEADERS,
            logLabel: "API debug-server-logs error:",
        })
    }
}
