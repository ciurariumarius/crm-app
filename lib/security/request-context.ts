import { randomUUID } from "node:crypto"
import { isIP } from "node:net"
import { headers } from "next/headers"

const MAX_HEADER_LENGTH = 512
const MAX_ACCOUNT_IDENTIFIER_LENGTH = 128

function clampHeaderValue(value: string | null, maxLength = MAX_HEADER_LENGTH) {
    return value?.trim().slice(0, maxLength) || null
}

export function normalizeAccountIdentifier(value: string) {
    return value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .slice(0, MAX_ACCOUNT_IDENTIFIER_LENGTH)
}

export function getValidatedClientIp(requestHeaders: Headers) {
    const forwardedFor = clampHeaderValue(requestHeaders.get("x-forwarded-for"))
    const candidates = [
        ...(forwardedFor?.split(",").map((value) => value.trim()) || []),
        clampHeaderValue(requestHeaders.get("x-real-ip"), 128),
    ]

    for (const candidate of candidates) {
        if (candidate && isIP(candidate)) return candidate
    }

    return "unknown"
}

export function buildTrustedRequestContext(requestHeaders: Headers) {
    const requestId = clampHeaderValue(requestHeaders.get("x-request-id"), 128) || randomUUID()
    return {
        requestId,
        ipAddress: getValidatedClientIp(requestHeaders),
        userAgent: clampHeaderValue(requestHeaders.get("user-agent")) || "unknown",
    }
}

export async function getTrustedRequestContext() {
    try {
        return buildTrustedRequestContext(await headers())
    } catch {
        return {
            requestId: randomUUID(),
            ipAddress: "unknown",
            userAgent: "unknown",
        }
    }
}
