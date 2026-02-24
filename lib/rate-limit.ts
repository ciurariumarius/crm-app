/**
 * Simple in-memory rate limiter for login and 2FA endpoints.
 * For single-server deployments (SQLite-based apps).
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 10           // max attempts per window

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    // Clean up expired entries periodically
    if (rateLimitMap.size > 10000) {
        for (const [k, v] of rateLimitMap) {
            if (now > v.resetTime) rateLimitMap.delete(k)
        }
    }

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS })
        return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
    }

    if (entry.count >= MAX_ATTEMPTS) {
        return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: MAX_ATTEMPTS - entry.count }
}
