import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { ActionError } from "@/lib/action-errors"
import { logger } from "@/lib/logger"

export function apiOk<T>(data: T, status = 200) {
    return NextResponse.json(data, { status })
}

export function apiError(
    message: string,
    status = 400,
    options?: { code?: string; details?: unknown; headers?: HeadersInit }
) {
    return NextResponse.json(
        {
            success: false,
            error: message,
            code: options?.code,
            details: options?.details,
        },
        { status, headers: options?.headers }
    )
}

export function apiMethodNotAllowed(allowed: string[]) {
    return apiError("Method Not Allowed", 405, { headers: { Allow: allowed.join(", ") } })
}

export function apiInternalError(error: unknown, fallbackMessage = "Internal Server Error") {
    logger.error("api.internal_error", { error })
    return apiError(fallbackMessage, 500, { code: "INTERNAL_ERROR" })
}

type ApiRouteErrorOptions = {
    fallbackMessage?: string
    fallbackCode?: string
    unauthorizedMessage?: string
    unauthorizedCode?: string
    headers?: HeadersInit
    logLabel?: string
}

function isUnauthorizedError(error: unknown) {
    return error instanceof Error && error.message === "Unauthorized"
}

export function apiRouteError(error: unknown, options?: ApiRouteErrorOptions) {
    const fallbackMessage = options?.fallbackMessage ?? "Internal Server Error"
    const fallbackCode = options?.fallbackCode ?? "INTERNAL_ERROR"
    const unauthorizedMessage = options?.unauthorizedMessage ?? "Unauthorized"
    const unauthorizedCode = options?.unauthorizedCode ?? "AUTH_REQUIRED"
    const headers = options?.headers

    if (isUnauthorizedError(error)) {
        return apiError(unauthorizedMessage, 401, { code: unauthorizedCode, headers })
    }

    if (error instanceof ZodError) {
        return apiError(error.issues[0]?.message ?? "Invalid request data", 400, {
            code: "INVALID_REQUEST",
            headers,
        })
    }

    if (error instanceof ActionError) {
        return apiError(error.userMessage, 400, { code: error.code, headers })
    }

    logger.error("api.route_error", {
        label: options?.logLabel || "API route error",
        code: fallbackCode,
        error,
    })
    return apiError(fallbackMessage, 500, { code: fallbackCode, headers })
}
