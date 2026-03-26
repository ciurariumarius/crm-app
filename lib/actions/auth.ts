"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import {
    createSession,
    destroySession,
    getSession,
    encrypt,
    decrypt,
    isSensitiveActionReauthRequired,
    isSessionRegistryEnabled,
} from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { logAuditEvent } from "@/lib/audit"
import { decryptSensitiveValue, encryptSensitiveValue, shouldRotateSensitiveValue } from "@/lib/crypto"
import bcrypt from "bcryptjs"
import * as OTPAuth from "otpauth"
import { headers } from "next/headers"

async function getRequestContext() {
    const hdrs = await headers()
    const forwardedFor = hdrs.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"
    const userAgent = hdrs.get("user-agent") || "unknown"
    return { ipAddress, userAgent }
}

function parseRememberDeviceValue(value: FormDataEntryValue | undefined) {
    if (typeof value !== "string") return false
    const normalized = value.trim().toLowerCase()
    return normalized === "on" || normalized === "true" || normalized === "1"
}

function parseNonNegativeInt(value: FormDataEntryValue | null, fallback: number, max: number) {
    if (typeof value !== "string") return fallback
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 0) return fallback
    return Math.min(parsed, max)
}

const RATE_LIMIT_FALLBACK_WINDOW_MS = 15 * 60 * 1000

function blockRequestWhenRateLimitUnavailable() {
    return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + RATE_LIMIT_FALLBACK_WINDOW_MS),
    }
}

async function checkRateLimitSafe(
    key: string,
    options?: { windowMs?: number; maxAttempts?: number }
) {
    try {
        return await checkRateLimit(key, options)
    } catch (error) {
        console.error(`[auth] rate limit check failed for key "${key}"`, error)
        return blockRequestWhenRateLimitUnavailable()
    }
}

export async function loginUser(formData: FormData) {
    const data = Object.fromEntries(formData.entries())
    const username = data.username as string
    const password = data.password as string
    const rememberDevice = parseRememberDeviceValue(data.rememberDevice as FormDataEntryValue | undefined)

    if (!username || !password) {
        return { success: false, error: "Username and password required" }
    }

    try {
        const { ipAddress, userAgent } = await getRequestContext()

        const ipRl = await checkRateLimitSafe(`login_ip:${ipAddress}`, { maxAttempts: 50 })
        if (!ipRl.allowed) {
            await logAuditEvent({
                action: "AUTH_LOGIN_IP_RATE_LIMITED",
                success: false,
                ipAddress,
                userAgent,
            })
            return { success: false, error: "Too many login attempts from this network. Please try again later." }
        }

        const rl = await checkRateLimitSafe(`login:${username}:${ipAddress}`)
        if (!rl.allowed) {
            await logAuditEvent({
                action: "AUTH_LOGIN_RATE_LIMITED",
                success: false,
                ipAddress,
                userAgent,
                details: `username=${username}`,
            })
            return { success: false, error: "Too many login attempts. Please try again later." }
        }

        const user = await prisma.user.findUnique({ where: { username } })
        if (!user) {
            await logAuditEvent({
                action: "AUTH_LOGIN_FAILED",
                success: false,
                ipAddress,
                userAgent,
                details: `username=${username}; reason=user_not_found`,
            })
            return { success: false, error: "Invalid credentials" }
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
            await logAuditEvent({
                action: "AUTH_LOGIN_FAILED",
                success: false,
                tenantId: user.tenantId,
                actorUserId: user.id,
                ipAddress,
                userAgent,
                details: "reason=invalid_password",
            })
            return { success: false, error: "Invalid credentials" }
        }

        if (user.twoFactorEnabled) {
            const challengeToken = await encrypt({
                userId: user.id,
                tenantId: user.tenantId,
                purpose: "2fa_challenge",
                rememberDevice,
                exp: Math.floor(Date.now() / 1000) + 300,
            })
            await logAuditEvent({
                action: "AUTH_LOGIN_2FA_CHALLENGE",
                success: true,
                tenantId: user.tenantId,
                actorUserId: user.id,
                ipAddress,
                userAgent,
            })
            return { success: true, requiresTwoFactor: true, challengeToken }
        }

        await createSession(user.id, user.username, user.tenantId, true, rememberDevice, {
            ipAddress,
            userAgent,
        })
        await logAuditEvent({
            action: "AUTH_LOGIN_SUCCESS",
            success: true,
            tenantId: user.tenantId,
            actorUserId: user.id,
            ipAddress,
            userAgent,
        })
        return { success: true }

    } catch (error) {
        console.error("[auth] loginUser failed", error)
        return { success: false, error: "Login failed. Please try again." }
    }
}

export async function verifyTwoFactor(challengeToken: string, token: string) {
    try {
        const { ipAddress, userAgent } = await getRequestContext()
        const challenge = await decrypt(challengeToken)
        if (!challenge || challenge.purpose !== "2fa_challenge") {
            return { success: false, error: "Invalid or expired challenge" }
        }

        if (challenge.exp && challenge.exp < Math.floor(Date.now() / 1000)) {
            return { success: false, error: "Challenge expired. Please log in again." }
        }

        const userId = challenge.userId as string
        const challengeTenantId = challenge.tenantId as string | undefined
        const rememberDevice = challenge.rememberDevice === true

        const ipRl = await checkRateLimitSafe(`2fa_ip:${ipAddress}`, { maxAttempts: 100 })
        if (!ipRl.allowed) {
            await logAuditEvent({
                action: "AUTH_2FA_IP_RATE_LIMITED",
                success: false,
                tenantId: challengeTenantId,
                actorUserId: userId,
                ipAddress,
                userAgent,
            })
            return { success: false, error: "Too many verification attempts from this network. Please try again later." }
        }

        const rl = await checkRateLimitSafe(`2fa:${userId}:${ipAddress}`)
        if (!rl.allowed) {
            await logAuditEvent({
                action: "AUTH_2FA_RATE_LIMITED",
                success: false,
                tenantId: challengeTenantId,
                actorUserId: userId,
                ipAddress,
                userAgent,
            })
            return { success: false, error: "Too many verification attempts. Please try again later." }
        }

        const user = await prisma.user.findFirst({
            where: challengeTenantId
                ? { id: userId, tenantId: challengeTenantId }
                : { id: userId },
        })
        if (!user || !user.twoFactorSecret) {
            return { success: false, error: "Invalid user or 2FA not set up" }
        }

        let decryptedSecret: string
        try {
            decryptedSecret = decryptSensitiveValue(user.twoFactorSecret)
        } catch {
            await logAuditEvent({
                action: "AUTH_2FA_FAILED",
                success: false,
                tenantId: user.tenantId,
                actorUserId: user.id,
                ipAddress,
                userAgent,
                details: "reason=secret_decryption_failed",
            })
            return { success: false, error: "2FA configuration is invalid. Contact support." }
        }

        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(decryptedSecret),
            algorithm: "SHA1",
            digits: 6,
            period: 30,
        })
        const delta = totp.validate({ token, window: 1 })

        if (delta === null) {
            await logAuditEvent({
                action: "AUTH_2FA_FAILED",
                success: false,
                tenantId: user.tenantId,
                actorUserId: user.id,
                ipAddress,
                userAgent,
                details: "reason=invalid_token",
            })
            return { success: false, error: "Invalid authenticator code" }
        }

        if (shouldRotateSensitiveValue(user.twoFactorSecret)) {
            try {
                await prisma.user.updateMany({
                    where: { id: user.id, tenantId: user.tenantId },
                    data: { twoFactorSecret: encryptSensitiveValue(decryptedSecret) },
                })
            } catch {
                // Keep login successful even if opportunistic migration fails.
            }
        }

        await createSession(user.id, user.username, user.tenantId, true, rememberDevice, {
            ipAddress,
            userAgent,
        })
        await logAuditEvent({
            action: "AUTH_2FA_SUCCESS",
            success: true,
            tenantId: user.tenantId,
            actorUserId: user.id,
            ipAddress,
            userAgent,
        })
        return { success: true }
    } catch {
        return { success: false, error: "Verification failed" }
    }
}

export async function logoutUser() {
    const session = await getSession()
    const { ipAddress, userAgent } = await getRequestContext()
    await destroySession()
    await logAuditEvent({
        action: "AUTH_LOGOUT",
        success: true,
        tenantId: session?.tenantId,
        actorUserId: session?.userId,
        ipAddress,
        userAgent,
    })
    return { success: true }
}

export async function changePassword(formData: FormData) {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (isSensitiveActionReauthRequired(session)) {
        return { success: false, error: "For security, please sign in again before performing this action." }
    }

    const { ipAddress, userAgent } = await getRequestContext()
    const currentPassword = formData.get("currentPassword") as string
    const newPassword = formData.get("newPassword") as string

    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "New password must be at least 8 characters long" }
    }

    const user = await prisma.user.findFirst({ where: { id: session.userId, tenantId: session.tenantId } })
    if (!user) return { success: false, error: "User not found" }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
        await logAuditEvent({
            action: "AUTH_PASSWORD_CHANGE_FAILED",
            success: false,
            tenantId: user.tenantId,
            actorUserId: user.id,
            ipAddress,
            userAgent,
            details: "reason=invalid_current_password",
        })
        return { success: false, error: "Incorrect current password" }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    })

    await logAuditEvent({
        action: "AUTH_PASSWORD_CHANGED",
        success: true,
        tenantId: user.tenantId,
        actorUserId: user.id,
        ipAddress,
        userAgent,
    })

    return { success: true }
}

export async function generateTwoFactorSecret() {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (isSensitiveActionReauthRequired(session)) {
        return { success: false, error: "For security, please sign in again before performing this action." }
    }

    const { ipAddress, userAgent } = await getRequestContext()
    const user = await prisma.user.findFirst({ where: { id: session.userId, tenantId: session.tenantId } })
    if (!user) return { success: false, error: "User not found" }

    const secret = new OTPAuth.Secret()
    const totp = new OTPAuth.TOTP({
        issuer: "Pixelist",
        label: user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
    });

    await logAuditEvent({
        action: "AUTH_2FA_SECRET_GENERATED",
        success: true,
        tenantId: user.tenantId,
        actorUserId: user.id,
        ipAddress,
        userAgent,
    })

    return { success: true, secret: secret.base32, otpauth: totp.toString() }
}

export async function enableTwoFactor(token: string, secret: string) {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (isSensitiveActionReauthRequired(session)) {
        return { success: false, error: "For security, please sign in again before performing this action." }
    }
    const { ipAddress, userAgent } = await getRequestContext()

    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    })
    const delta = totp.validate({ token, window: 1 })
    if (delta === null) {
        await logAuditEvent({
            action: "AUTH_2FA_ENABLE_FAILED",
            success: false,
            tenantId: session.tenantId,
            actorUserId: session.userId,
            ipAddress,
            userAgent,
            details: "reason=invalid_token",
        })
        return { success: false, error: "Invalid code" }
    }

    let encryptedSecret: string
    try {
        encryptedSecret = encryptSensitiveValue(secret)
    } catch {
        return { success: false, error: "2FA encryption is not configured on the server" }
    }

    await prisma.user.updateMany({
        where: { id: session.userId, tenantId: session.tenantId },
        data: { twoFactorEnabled: true, twoFactorSecret: encryptedSecret }
    })

    await logAuditEvent({
        action: "AUTH_2FA_ENABLED",
        success: true,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
    })

    return { success: true }
}

export async function disableTwoFactor(currentPassword: string) {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (isSensitiveActionReauthRequired(session)) {
        return { success: false, error: "For security, please sign in again before performing this action." }
    }
    const { ipAddress, userAgent } = await getRequestContext()
    if (!currentPassword) return { success: false, error: "Current password is required" }

    const user = await prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: { id: true, passwordHash: true, tenantId: true },
    })
    if (!user) return { success: false, error: "User not found" }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
        await logAuditEvent({
            action: "AUTH_2FA_DISABLE_FAILED",
            success: false,
            tenantId: user.tenantId,
            actorUserId: user.id,
            ipAddress,
            userAgent,
            details: "reason=invalid_current_password",
        })
        return { success: false, error: "Incorrect current password" }
    }

    await prisma.user.updateMany({
        where: { id: session.userId, tenantId: session.tenantId },
        data: { twoFactorEnabled: false, twoFactorSecret: null }
    })

    await logAuditEvent({
        action: "AUTH_2FA_DISABLED",
        success: true,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
    })

    return { success: true }
}

export async function updateProfile(formData: FormData) {
    try {
        const session = await getSession()
        if (!session) return { success: false, error: "Unauthorized" }
        const { ipAddress, userAgent } = await getRequestContext()

        const name = formData.get("name") as string
        const profilePic = formData.get("profilePic") as string
        const hourlyRateRaw = formData.get("hourlyRate") as string
        const hourlyRate = hourlyRateRaw ? Number(hourlyRateRaw) : 0
        const timerIdlePauseMinutes = parseNonNegativeInt(formData.get("timerIdlePauseMinutes"), 60, 240)
        const timerHardCapHours = parseNonNegativeInt(formData.get("timerHardCapHours"), 3, 24)
        const timerReminderIntervalMinutes = parseNonNegativeInt(formData.get("timerReminderIntervalMinutes"), 60, 240)

        try {
            await prisma.user.updateMany({
                where: { id: session.userId, tenantId: session.tenantId },
                data: {
                    name: name || null,
                    profilePic: profilePic || null,
                    hourlyRate,
                    timerIdlePauseMinutes,
                    timerHardCapHours,
                    timerReminderIntervalMinutes,
                }
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : ""
            const timerColumnsUnavailable = message.includes("timerIdlePauseMinutes")
                || message.includes("timerHardCapHours")
                || message.includes("timerReminderIntervalMinutes")

            if (!timerColumnsUnavailable) throw error

            // Backward-compatible fallback while migration is pending.
            await prisma.user.updateMany({
                where: { id: session.userId, tenantId: session.tenantId },
                data: {
                    name: name || null,
                    profilePic: profilePic || null,
                    hourlyRate,
                }
            })
        }

        await logAuditEvent({
            action: "AUTH_PROFILE_UPDATED",
            success: true,
            tenantId: session.tenantId,
            actorUserId: session.userId,
            ipAddress,
            userAgent,
        })

        revalidatePath("/")
        revalidatePath("/settings")
        return { success: true }
    } catch {
        return { success: false, error: "Failed to update profile" }
    }
}

export async function revokeOtherDeviceSessions() {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!isSessionRegistryEnabled()) {
        return { success: false, error: "Device session management is disabled." }
    }
    if (!session.sid) {
        return { success: false, error: "Current session identifier is missing." }
    }

    const { ipAddress, userAgent } = await getRequestContext()
    const revokedAt = new Date()
    const result = await prisma.authSession.updateMany({
        where: {
            tenantId: session.tenantId,
            userId: session.userId,
            revokedAt: null,
            id: { not: session.sid },
        },
        data: {
            revokedAt,
        },
    })

    await logAuditEvent({
        action: "AUTH_SESSIONS_REVOKED_OTHERS",
        success: true,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
        details: `revokedCount=${result.count}`,
    })

    revalidatePath("/settings")
    return { success: true, revokedCount: result.count }
}

export async function revokeDeviceSession(sessionId: string) {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!isSessionRegistryEnabled()) {
        return { success: false, error: "Device session management is disabled." }
    }

    const normalizedSessionId = (sessionId || "").trim()
    if (!normalizedSessionId) {
        return { success: false, error: "Session ID is required." }
    }

    const { ipAddress, userAgent } = await getRequestContext()
    const revokedAt = new Date()
    const result = await prisma.authSession.updateMany({
        where: {
            id: normalizedSessionId,
            tenantId: session.tenantId,
            userId: session.userId,
            revokedAt: null,
        },
        data: {
            revokedAt,
        },
    })

    if (result.count === 0) {
        return { success: false, error: "Session not found or already revoked." }
    }

    const revokedCurrent = session.sid === normalizedSessionId
    if (revokedCurrent) {
        await destroySession()
    }

    await logAuditEvent({
        action: "AUTH_SESSION_REVOKED",
        success: true,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        ipAddress,
        userAgent,
        details: `sessionId=${normalizedSessionId}; revokedCurrent=${revokedCurrent}`,
    })

    revalidatePath("/settings")
    return { success: true, revokedCurrent }
}
