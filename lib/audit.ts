import prisma from "@/lib/prisma"
import { headers } from "next/headers"
import type { SessionPayload } from "@/lib/auth"

export async function logAuditEvent(data: {
    action: string
    success?: boolean
    actorUserId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    details?: string | null
}) {
    try {
        await prisma.auditLog.create({
            data: {
                action: data.action,
                success: data.success ?? true,
                actorUserId: data.actorUserId ?? null,
                ipAddress: data.ipAddress ?? null,
                userAgent: data.userAgent ?? null,
                details: data.details ?? null,
            },
        })
    } catch {
        // Do not block user flows if audit insert fails.
    }
}

export async function getAuditRequestContext() {
    try {
        const hdrs = await headers()
        const forwardedFor = hdrs.get("x-forwarded-for")
        const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"
        const userAgent = hdrs.get("user-agent") || "unknown"
        return { ipAddress, userAgent }
    } catch {
        return { ipAddress: "unknown", userAgent: "unknown" }
    }
}

export async function logSessionAuditEvent(
    session: Pick<SessionPayload, "userId">,
    data: {
        action: string
        success?: boolean
        details?: string | null
    }
) {
    const { ipAddress, userAgent } = await getAuditRequestContext()
    await logAuditEvent({
        action: data.action,
        success: data.success,
        details: data.details,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
    })
}
