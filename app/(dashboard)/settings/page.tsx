import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettingsContent } from "./settings-content"
import type { DeviceSessionData, UserData } from "./settings-content"
import { requireAuth } from "@/lib/auth"
import { isSessionRegistryEnabled } from "@/lib/auth"

export default async function SettingsPage() {
    let session: Awaited<ReturnType<typeof requireAuth>>
    try {
        session = await requireAuth()
    } catch {
        redirect("/login")
    }

    let user: {
        name: string | null
        username: string
        profilePic: string | null
        twoFactorEnabled: boolean
        hourlyRate: unknown
        timerIdlePauseMinutes: number | null
        timerHardCapHours: number | null
        timerReminderIntervalMinutes: number | null
    } | null = null

    try {
        user = await prisma.user.findFirst({
            where: { id: session.userId },
            select: {
                name: true,
                username: true,
                profilePic: true,
                twoFactorEnabled: true,
                hourlyRate: true,
                timerIdlePauseMinutes: true,
                timerHardCapHours: true,
                timerReminderIntervalMinutes: true,
            }
        })
    } catch (error) {
        console.warn("[settings] Timer preference fields unavailable; using defaults.", error)
        const fallbackUser = await prisma.user.findFirst({
            where: { id: session.userId },
            select: {
                name: true,
                username: true,
                profilePic: true,
                twoFactorEnabled: true,
                hourlyRate: true,
            }
        })
        if (fallbackUser) {
            user = {
                ...fallbackUser,
                timerIdlePauseMinutes: 60,
                timerHardCapHours: 3,
                timerReminderIntervalMinutes: 60,
            }
        }
    }

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
