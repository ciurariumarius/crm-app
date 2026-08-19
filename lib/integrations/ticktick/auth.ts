import prisma from "@/lib/prisma"
import { encryptSensitiveValue, decryptSensitiveValue } from "@/lib/crypto"
import { logger } from "@/lib/logger"
import crypto from "crypto"

const TICKTICK_PROVIDER = "ticktick"
const TICKTICK_AUTH_ENDPOINT = "https://ticktick.com/oauth/authorize"
const TICKTICK_TOKEN_ENDPOINT = "https://ticktick.com/oauth/token"
const TICKTICK_DEFAULT_SCOPE = "tasks:write tasks:read"

function getAppBaseUrl(origin?: string): string {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.trim().replace(/\/+$/, "")
    }
    if (origin && origin.trim()) {
        const cleaned = origin.trim().replace(/\/+$/, "")
        if (!cleaned.includes("localhost") && !cleaned.includes("127.0.0.1")) {
            return cleaned
        }
    }
    return process.env.NODE_ENV === "production" ? "https://crm.populatia.ro" : (origin?.trim() || "http://localhost:3000")
}

export function getTickTickRedirectUri(origin?: string): string {
    const customUri = process.env.TICKTICK_REDIRECT_URI
    if (customUri && customUri.trim()) {
        return customUri.trim()
    }
    return `${getAppBaseUrl(origin)}/api/integrations/ticktick/callback`
}

export function isTickTickOAuthConfigured(): boolean {
    const clientId = process.env.TICKTICK_CLIENT_ID?.trim().replace(/^["']|["']$/g, "")
    const clientSecret = process.env.TICKTICK_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, "")
    return Boolean(clientId && clientSecret)
}

/**
 * Generate a secure signed state token for OAuth authorization
 */
export function generateOAuthState(userId: string): string {
    const timestamp = Date.now()
    const nonce = crypto.randomBytes(16).toString("hex")
    const secret = process.env.JWT_SECRET || "ticktick-oauth-state-secret"
    const payload = `${userId}:${timestamp}:${nonce}`
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex")
    return Buffer.from(JSON.stringify({ payload, hmac })).toString("base64url")
}

/**
 * Verify the OAuth state parameter
 */
export function verifyOAuthState(state: string, expectedUserId: string): boolean {
    const extracted = extractUserIdFromOAuthState(state)
    return Boolean(extracted && extracted === expectedUserId)
}

/**
 * Extract and verify userId directly from signed OAuth state
 */
export function extractUserIdFromOAuthState(state: string): string | null {
    try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { payload: string; hmac: string }
        if (!decoded.payload || !decoded.hmac) return null

        const secret = process.env.JWT_SECRET || "ticktick-oauth-state-secret"
        const expectedHmac = crypto.createHmac("sha256", secret).update(decoded.payload).digest("hex")
        if (!crypto.timingSafeEqual(Buffer.from(decoded.hmac), Buffer.from(expectedHmac))) {
            return null
        }

        const [userId, timestampStr] = decoded.payload.split(":")
        if (!userId) return null

        const timestamp = Number.parseInt(timestampStr, 10)
        // State is valid for 15 minutes
        if (Date.now() - timestamp > 15 * 60 * 1000) return null

        return userId
    } catch {
        return null
    }
}

/**
 * Construct TickTick OAuth Authorization URL
 */
export function getTickTickAuthUrl(userId: string, origin?: string): string {
    const clientId = process.env.TICKTICK_CLIENT_ID?.trim().replace(/^["']|["']$/g, "")
    if (!clientId) {
        throw new Error("TICKTICK_CLIENT_ID is not configured in environment variables")
    }

    const state = generateOAuthState(userId)
    const redirectUri = getTickTickRedirectUri(origin)

    const params = new URLSearchParams({
        client_id: clientId,
        scope: TICKTICK_DEFAULT_SCOPE,
        response_type: "code",
        redirect_uri: redirectUri,
        state,
    })

    return `${TICKTICK_AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Exchange OAuth authorization code for Access Token
 */
export async function exchangeTickTickCode(
    code: string,
    state: string,
    userId: string,
    origin?: string
): Promise<{ success: boolean; error?: string }> {
    if (!verifyOAuthState(state, userId)) {
        return { success: false, error: "Invalid or expired OAuth state parameter" }
    }

    const clientId = process.env.TICKTICK_CLIENT_ID?.trim().replace(/^["']|["']$/g, "")
    const clientSecret = process.env.TICKTICK_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, "")
    const redirectUri = getTickTickRedirectUri(origin)

    if (!clientId || !clientSecret) {
        return { success: false, error: "TickTick OAuth credentials not configured" }
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const bodyParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        scope: TICKTICK_DEFAULT_SCOPE,
        redirect_uri: redirectUri,
    })

    try {
        const response = await fetch(TICKTICK_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${basicAuth}`,
            },
            body: bodyParams.toString(),
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error("[ticktick-auth] Token exchange failed", { status: response.status, body: errorText })
            return { success: false, error: `Failed to exchange authorization code: HTTP ${response.status} - ${errorText}` }
        }

        const data = (await response.json()) as {
            access_token?: string
            refresh_token?: string
            expires_in?: number
            token_type?: string
        }

        if (!data.access_token) {
            return { success: false, error: "No access token returned from TickTick" }
        }

        const encryptedAccessToken = encryptSensitiveValue(data.access_token)
        const encryptedRefreshToken = data.refresh_token ? encryptSensitiveValue(data.refresh_token) : null
        const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null

        await prisma.integration.upsert({
            where: { provider: TICKTICK_PROVIDER },
            create: {
                provider: TICKTICK_PROVIDER,
                enabled: true,
                accessTokenEncrypted: encryptedAccessToken,
                refreshTokenEncrypted: encryptedRefreshToken,
                tokenExpiresAt,
                lastError: null,
            },
            update: {
                enabled: true,
                accessTokenEncrypted: encryptedAccessToken,
                refreshTokenEncrypted: encryptedRefreshToken,
                tokenExpiresAt,
                lastError: null,
            },
        })

        logger.info("[ticktick-auth] TickTick account connected successfully")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error during token exchange"
        logger.error("[ticktick-auth] Error exchanging code", { error: message })
        return { success: false, error: message }
    }
}

/**
 * Retrieve decrypted active TickTick access token
 */
export async function getTickTickAccessToken(): Promise<string | null> {
    try {
        const integration = await prisma.integration.findUnique({
            where: { provider: TICKTICK_PROVIDER },
        })

        if (!integration || !integration.enabled || !integration.accessTokenEncrypted) {
            return null
        }

        return decryptSensitiveValue(integration.accessTokenEncrypted)
    } catch {
        return null
    }
}

/**
 * Get the TickTick Integration database record
 */
export async function getTickTickIntegrationRecord() {
    try {
        return await prisma.integration.findUnique({
            where: { provider: TICKTICK_PROVIDER },
        })
    } catch {
        return null
    }
}

/**
 * Disconnect TickTick integration
 */
export async function disconnectTickTick(): Promise<{ success: boolean }> {
    await prisma.integration.updateMany({
        where: { provider: TICKTICK_PROVIDER },
        data: {
            enabled: false,
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            tokenExpiresAt: null,
            lastError: null,
        },
    })
    logger.info("[ticktick-auth] TickTick integration disconnected")
    return { success: true }
}

/**
 * Update configured TickTick synced list/project
 */
export async function updateTickTickSyncedProject(projectId: string, projectName?: string) {
    return prisma.integration.update({
        where: { provider: TICKTICK_PROVIDER },
        data: {
            externalProjectId: projectId,
            externalProjectName: projectName || null,
        },
    })
}
