import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettingsContent } from "./settings-content"
import type { DeviceSessionData, UserData } from "./settings-content"
import { requireTenantContext } from "@/lib/tenant"
import { isSessionRegistryEnabled } from "@/lib/auth"

export default async function SettingsPage() {
    let session: Awaited<ReturnType<typeof requireTenantContext>>
    try {
        session = await requireTenantContext()
    } catch {
        redirect("/login")
    }

    const user = await prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: {
            name: true,
            username: true,
            profilePic: true,
            twoFactorEnabled: true,
            hourlyRate: true
        }
    })

    if (!user) {
        redirect("/login")
    }

    let sessionRegistryEnabled = isSessionRegistryEnabled()
    let deviceSessions: DeviceSessionData[] = []

    if (sessionRegistryEnabled) {
        try {
            const now = new Date()
            const sessions = await prisma.authSession.findMany({
                where: {
                    tenantId: session.tenantId,
                    userId: session.userId,
                    revokedAt: null,
                    maxSessionExpiresAt: { gt: now },
                    expiresAt: { gt: now },
                },
                select: {
                    id: true,
                    userAgent: true,
                    ipAddress: true,
                    rememberDevice: true,
                    expiresAt: true,
                    lastSeenAt: true,
                    createdAt: true,
                },
                orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
                take: 20,
            })

            deviceSessions = sessions.map((item) => ({
                id: item.id,
                userAgent: item.userAgent,
                ipAddress: item.ipAddress,
                rememberDevice: item.rememberDevice,
                expiresAt: item.expiresAt.toISOString(),
                lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : null,
                createdAt: item.createdAt.toISOString(),
                isCurrent: session.sid === item.id,
            }))
        } catch {
            sessionRegistryEnabled = false
            deviceSessions = []
        }
    }

    return (
        <SettingsContent
            user={user as UserData}
            sessionRegistryEnabled={sessionRegistryEnabled}
            deviceSessions={deviceSessions}
        />
    )
}
