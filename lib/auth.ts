import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import type { JWTPayload } from "jose"
import { randomUUID } from "node:crypto"
import prisma from "./prisma"

const secretKey = process.env.JWT_SECRET
if (!secretKey) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. The application cannot start without it.")
}
const key = new TextEncoder().encode(secretKey)

const IS_PRODUCTION = process.env.NODE_ENV === "production"

export const SESSION_COOKIE_NAME = IS_PRODUCTION ? "__Host-crm_session" : "crm_session"
const DAY_IN_MS = 24 * 60 * 60 * 1000
const DEFAULT_SESSION_TTL_DAYS = 7
const DEFAULT_SESSION_REMEMBER_TTL_DAYS = 3650
const DEFAULT_SESSION_REFRESH_WINDOW_HOURS = 72
const DEFAULT_SESSION_ABSOLUTE_MAX_DAYS = 90
const DEFAULT_SESSION_REMEMBER_ABSOLUTE_MAX_DAYS = 36500
const DEFAULT_SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS = 24
const DEFAULT_SESSION_INACTIVITY_TIMEOUT_DAYS = 45
const SESSION_LAST_SEEN_TOUCH_MS = 5 * 60 * 1000
const SESSION_REGISTRY_ENABLED = process.env.ENABLE_SESSION_REGISTRY === "true"
const SESSION_REGISTRY_REQUIRED = IS_PRODUCTION

if (SESSION_REGISTRY_REQUIRED && !SESSION_REGISTRY_ENABLED) {
    throw new Error("FATAL: ENABLE_SESSION_REGISTRY must be true in production.")
}

export type SessionPayload = JWTPayload & {
    userId: string
    username: string
    tenantId: string
    twoFactorVerified: boolean
    rememberDevice?: boolean
    sid?: string
    authAt?: string
    expires?: string
    maxSessionExpires?: string
}

function parsePositiveIntEnv(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number
) {
    if (!value) return fallback
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(Math.max(parsed, min), max)
}

function parseIsoDate(value: string | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

function resolveAuthAtIso(session: SessionPayload) {
    const explicitAuthAt = parseIsoDate(session.authAt)
    if (explicitAuthAt) return explicitAuthAt.toISOString()
    if (typeof session.iat === "number" && Number.isFinite(session.iat)) {
        return new Date(session.iat * 1000).toISOString()
    }
    return new Date().toISOString()
}

function getSessionTtlDays(rememberDevice: boolean) {
    const standardDays = parsePositiveIntEnv(
        process.env.SESSION_TTL_DAYS,
        DEFAULT_SESSION_TTL_DAYS,
        1,
        365
    )
    const rememberDays = parsePositiveIntEnv(
        process.env.SESSION_REMEMBER_TTL_DAYS,
        DEFAULT_SESSION_REMEMBER_TTL_DAYS,
        1,
        36500
    )
    return rememberDevice ? rememberDays : standardDays
}

function getSessionRefreshWindowMs() {
    const refreshWindowHours = parsePositiveIntEnv(
        process.env.SESSION_REFRESH_WINDOW_HOURS,
        DEFAULT_SESSION_REFRESH_WINDOW_HOURS,
        1,
        168
    )
    return refreshWindowHours * 60 * 60 * 1000
}

function getSessionAbsoluteMaxDays(rememberDevice: boolean) {
    if (rememberDevice) {
        return parsePositiveIntEnv(
            process.env.SESSION_REMEMBER_ABSOLUTE_MAX_DAYS,
            DEFAULT_SESSION_REMEMBER_ABSOLUTE_MAX_DAYS,
            30,
            36500
        )
    }
    return parsePositiveIntEnv(
        process.env.SESSION_ABSOLUTE_MAX_DAYS,
        DEFAULT_SESSION_ABSOLUTE_MAX_DAYS,
        1,
        3650
    )
}

function getSensitiveActionMaxAgeMs() {
    const hours = parsePositiveIntEnv(
        process.env.SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS,
        DEFAULT_SESSION_SENSITIVE_ACTION_MAX_AGE_HOURS,
        1,
        168
    )
    return hours * 60 * 60 * 1000
}

function getSessionInactivityTimeoutMs() {
    const days = parsePositiveIntEnv(
        process.env.SESSION_INACTIVITY_TIMEOUT_DAYS,
        DEFAULT_SESSION_INACTIVITY_TIMEOUT_DAYS,
        1,
        365
    )
    return days * DAY_IN_MS
}

function getSessionCookieSameSite(): "strict" | "lax" {
    return IS_PRODUCTION ? "strict" : "lax"
}

function calculateSessionBoundaries(
    rememberDevice: boolean,
    existingMaxSessionExpires?: string
) {
    const now = Date.now()
    const requestedExpiresAt = new Date(now + getSessionTtlDays(rememberDevice) * DAY_IN_MS)
    const existingMax = parseIsoDate(existingMaxSessionExpires)
    const maxSessionExpiresAt = existingMax || new Date(now + getSessionAbsoluteMaxDays(rememberDevice) * DAY_IN_MS)
    const expiresAt = requestedExpiresAt.getTime() > maxSessionExpiresAt.getTime()
        ? maxSessionExpiresAt
        : requestedExpiresAt
    return { expiresAt, maxSessionExpiresAt }
}

export function isSessionPastAbsoluteMax(session: SessionPayload) {
    const maxSessionExpiresAt = parseIsoDate(session.maxSessionExpires)
    if (!maxSessionExpiresAt) return false
    return Date.now() > maxSessionExpiresAt.getTime()
}

export function isSensitiveActionReauthRequired(session: SessionPayload) {
    const authAt = parseIsoDate(session.authAt) || (
        typeof session.iat === "number" && Number.isFinite(session.iat)
            ? new Date(session.iat * 1000)
            : null
    )
    if (!authAt) return true
    return Date.now() - authAt.getTime() > getSensitiveActionMaxAgeMs()
}

export function isSessionRegistryEnabled() {
    return SESSION_REGISTRY_ENABLED
}

export function isSessionRegistryRequired() {
    return SESSION_REGISTRY_REQUIRED
}

function buildSessionPayload(args: {
    userId: string
    username: string
    tenantId: string
    twoFactorVerified: boolean
    rememberDevice: boolean
    sid?: string
    authAt: string
    expiresAt: Date
    maxSessionExpiresAt: Date
}): SessionPayload {
    return {
        userId: args.userId,
        username: args.username,
        tenantId: args.tenantId,
        twoFactorVerified: args.twoFactorVerified,
        rememberDevice: args.rememberDevice,
        sid: args.sid,
        authAt: args.authAt,
        expires: args.expiresAt.toISOString(),
        maxSessionExpires: args.maxSessionExpiresAt.toISOString(),
    }
}

async function loadSessionRegistryRecord(session: SessionPayload) {
    if (!SESSION_REGISTRY_ENABLED && !SESSION_REGISTRY_REQUIRED) return null
    if (!session.sid || !session.userId || !session.tenantId) return null
    return prisma.authSession.findFirst({
        where: {
            id: session.sid,
            tenantId: session.tenantId,
            userId: session.userId,
            revokedAt: null,
        },
    })
}

type SessionRegistryRecord = {
    id: string
    tenantId: string
    userId: string
    expiresAt: Date
    maxSessionExpiresAt: Date
    lastSeenAt: Date | null
    createdAt: Date
}

function isRegistryRecordExpired(record: SessionRegistryRecord) {
    const now = Date.now()
    return now > record.expiresAt.getTime() || now > record.maxSessionExpiresAt.getTime()
}

function isRegistryRecordInactive(record: SessionRegistryRecord) {
    const reference = record.lastSeenAt || record.createdAt
    return Date.now() - reference.getTime() > getSessionInactivityTimeoutMs()
}

async function logSessionAnomaly(
    session: Pick<SessionPayload, "tenantId" | "userId" | "sid">,
    reason: string
) {
    try {
        await prisma.auditLog.create({
            data: {
                action: "AUTH_SESSION_ANOMALY",
                success: false,
                tenantId: session.tenantId,
                actorUserId: session.userId,
                details: `sid=${session.sid ?? "missing"}; reason=${reason}`,
            },
        })
    } catch {
        // Do not block auth flows on audit insert failure.
    }
}

async function revokeRegistrySession(record: SessionRegistryRecord, reason: string) {
    await prisma.authSession.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date() },
    })

    await logSessionAnomaly(
        {
            tenantId: record.tenantId,
            userId: record.userId,
            sid: record.id,
        },
        reason
    )
}

async function touchRegistryLastSeenIfNeeded(record: SessionRegistryRecord) {
    const now = Date.now()
    if (record.lastSeenAt && now - record.lastSeenAt.getTime() < SESSION_LAST_SEEN_TOUCH_MS) return
    await prisma.authSession.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { lastSeenAt: new Date(now) },
    })
}

export async function encrypt(payload: JWTPayload, options?: { expiresAt?: Date }) {
    const jwt = new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()

    if (options?.expiresAt) {
        jwt.setExpirationTime(Math.floor(options.expiresAt.getTime() / 1000))
    } else {
        jwt.setExpirationTime("7d")
    }

    return await jwt.sign(key)
}

export async function decrypt<T = JWTPayload>(input: string): Promise<T | null> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ["HS256"],
        })
        return payload as T
    } catch {
        return null
    }
}

export async function createSession(
    userId: string,
    username: string,
    tenantId: string,
    twoFactorVerified: boolean = false,
    rememberDevice: boolean = false,
    metadata?: { ipAddress?: string; userAgent?: string; authAtIso?: string }
) {
    const { expiresAt, maxSessionExpiresAt } = calculateSessionBoundaries(rememberDevice)
    const sid = (SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) ? randomUUID() : undefined
    if (SESSION_REGISTRY_REQUIRED && !sid) {
        throw new Error("Session registry identifier is required in production.")
    }
    const authAt = metadata?.authAtIso || new Date().toISOString()
    const sessionPayload = buildSessionPayload({
        userId,
        username,
        tenantId,
        twoFactorVerified,
        rememberDevice,
        sid,
        authAt,
        expiresAt,
        maxSessionExpiresAt,
    })

    if ((SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) && sid) {
        await prisma.authSession.create({
            data: {
                id: sid,
                tenantId,
                userId,
                userAgent: metadata?.userAgent?.slice(0, 512) || null,
                ipAddress: metadata?.ipAddress?.slice(0, 128) || null,
                rememberDevice,
                expiresAt,
                maxSessionExpiresAt,
                lastSeenAt: new Date(),
            },
        })
    }

    const session = await encrypt(sessionPayload, { expiresAt })
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, session, {
        expires: expiresAt,
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: getSessionCookieSameSite(),
        path: "/",
    })
}

export async function getSession() {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!sessionCookie) return null

    const session = await decrypt<SessionPayload>(sessionCookie)
    if (!session) return null
    if (isSessionPastAbsoluteMax(session)) return null

    if ((SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) && !session.sid) {
        await logSessionAnomaly(session, "missing_sid")
        return null
    }

    if (SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) {
        const record = await loadSessionRegistryRecord(session)
        if (!record) {
            await logSessionAnomaly(session, "registry_record_missing")
            return null
        }

        if (isRegistryRecordExpired(record)) {
            await revokeRegistrySession(record, "registry_record_expired")
            return null
        }

        if (isRegistryRecordInactive(record)) {
            await revokeRegistrySession(record, "registry_record_inactive")
            return null
        }

        void touchRegistryLastSeenIfNeeded(record).catch(() => {})
    }

    return session
}

function shouldRefreshSession(parsed: SessionPayload) {
    if (!parsed.exp) return false
    const expiresAtMs = parsed.exp * 1000
    return expiresAtMs - Date.now() <= getSessionRefreshWindowMs()
}

export async function updateSession(request: NextRequest) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionCookie) return null

    const parsed = await decrypt<SessionPayload>(sessionCookie)
    if (!parsed || !parsed.userId || !parsed.username || !parsed.tenantId) return null
    if (isSessionPastAbsoluteMax(parsed)) return null
    if (!shouldRefreshSession(parsed)) return null

    let registryRecord: SessionRegistryRecord | null = null
    if ((SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) && !parsed.sid) {
        await logSessionAnomaly(parsed, "missing_sid_refresh")
        return null
    }

    if (SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) {
        registryRecord = await loadSessionRegistryRecord(parsed)
        if (!registryRecord) {
            await logSessionAnomaly(parsed, "registry_record_missing_refresh")
            return null
        }
        if (isRegistryRecordExpired(registryRecord)) {
            await revokeRegistrySession(registryRecord, "registry_record_expired_refresh")
            return null
        }
        if (isRegistryRecordInactive(registryRecord)) {
            await revokeRegistrySession(registryRecord, "registry_record_inactive_refresh")
            return null
        }
    }

    const rememberDevice = parsed.rememberDevice === true
    const maxSessionBase = registryRecord?.maxSessionExpiresAt.toISOString()
        || parsed.maxSessionExpires
        || (parsed.exp ? new Date(parsed.exp * 1000).toISOString() : undefined)
    const { expiresAt, maxSessionExpiresAt } = calculateSessionBoundaries(rememberDevice, maxSessionBase)
    if (expiresAt.getTime() <= Date.now()) return null
    if (parsed.exp && expiresAt.getTime() <= parsed.exp * 1000) return null

    const refreshedPayload = buildSessionPayload({
        userId: parsed.userId,
        username: parsed.username,
        tenantId: parsed.tenantId,
        twoFactorVerified: parsed.twoFactorVerified !== false,
        rememberDevice,
        sid: parsed.sid,
        authAt: resolveAuthAtIso(parsed),
        expiresAt,
        maxSessionExpiresAt,
    })

    if ((SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) && parsed.sid) {
        await prisma.authSession.updateMany({
            where: {
                id: parsed.sid,
                tenantId: parsed.tenantId,
                userId: parsed.userId,
                revokedAt: null,
            },
            data: {
                expiresAt,
                maxSessionExpiresAt,
                lastSeenAt: new Date(),
                rememberDevice,
            },
        })
    }

    const res = NextResponse.next()
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: await encrypt(refreshedPayload, { expiresAt }),
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: getSessionCookieSameSite(),
        expires: expiresAt,
        path: "/",
    })
    return res
}

export async function destroySession() {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if ((SESSION_REGISTRY_ENABLED || SESSION_REGISTRY_REQUIRED) && sessionCookie) {
        try {
            const parsed = await decrypt<SessionPayload>(sessionCookie)
            if (parsed?.sid && parsed.userId && parsed.tenantId) {
                await prisma.authSession.updateMany({
                    where: {
                        id: parsed.sid,
                        userId: parsed.userId,
                        tenantId: parsed.tenantId,
                        revokedAt: null,
                    },
                    data: {
                        revokedAt: new Date(),
                    },
                })
            }
        } catch {
            // Continue cookie destroy even if registry revoke fails.
        }
    }

    cookieStore.set(SESSION_COOKIE_NAME, "", {
        expires: new Date(0),
        secure: IS_PRODUCTION,
        sameSite: getSessionCookieSameSite(),
        httpOnly: true,
        path: "/",
    })
}

export async function requireAuth() {
    const session = await getSession()
    if (!session || !session.userId || !session.tenantId) {
        throw new Error("Unauthorized")
    }
    return session
}
