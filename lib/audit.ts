import prisma from "@/lib/prisma"
import type { SessionPayload } from "@/lib/auth"
import { getTrustedRequestContext } from "@/lib/security/request-context"

export async function logAuditEvent(data: {
    action: string
    success?: boolean
    actorUserId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    requestId?: string | null
    details?: string | null
}) {
    try {
        const requestDetail = data.requestId ? `requestId=${data.requestId}` : ""
        const details = [requestDetail, data.details || ""].filter(Boolean).join("; ") || null
        await prisma.auditLog.create({
            data: {
                action: data.action,
                success: data.success ?? true,
                actorUserId: data.actorUserId ?? null,
                ipAddress: data.ipAddress ?? null,
                userAgent: data.userAgent ?? null,
                details,
            },
        })
    } catch {
        // Do not block user flows if audit insert fails.
    }
}

export async function getAuditRequestContext() {
    return getTrustedRequestContext()
}

export async function logSessionAuditEvent(
    session: Pick<SessionPayload, "userId">,
    data: {
        action: string
        success?: boolean
        details?: string | null
    }
) {
    const { ipAddress, userAgent, requestId } = await getAuditRequestContext()
    await logAuditEvent({
        action: data.action,
        success: data.success,
        details: data.details,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
        requestId,
    })
}
