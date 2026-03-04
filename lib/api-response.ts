import { NextResponse } from "next/server"

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
    console.error("API error:", error)
    return apiError(fallbackMessage, 500, { code: "INTERNAL_ERROR" })
}
