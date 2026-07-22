import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    decrypt,
    isSessionPastAbsoluteMax,
    isSessionRegistryEnabled,
    isSessionRegistryRequired,
    SESSION_COOKIE_NAME,
    type SessionPayload,
    updateSession,
} from './lib/auth'
import { runSecurityPreflight } from './lib/security/preflight'

const PUBLIC_PATHS = ['/login', '/manifest.json', '/sw.js']
// Cron routes perform their own timing-safe CRON_SECRET authentication.
const PUBLIC_API_PATHS = ['/api/cron/rollover', '/api/cron/lms-daily-admin-work']
const STATIC_ASSET_PATTERN = /\.(ico|png|svg|jpg|jpeg|gif|webp|txt|xml)$/i

runSecurityPreflight()

// Protected routes configuration
const isProtectedRoute = (path: string) => {
    if (PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`))) return false
    if (PUBLIC_API_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`))) return false

    // Allow static assets, images, icons, next build files
    if (path.startsWith('/_next') || path.startsWith('/icons') || STATIC_ASSET_PATTERN.test(path)) return false

    return true
}

const unauthorizedResponse = (request: NextRequest) => {
    if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        )
    }
    return NextResponse.redirect(new URL('/login', request.url))
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Ignore non-protected routes
    if (!isProtectedRoute(pathname)) {
        return NextResponse.next()
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
        return unauthorizedResponse(request)
    }

    // Verify session
    const session = await decrypt<SessionPayload>(sessionCookie)

    if (!session) {
        return unauthorizedResponse(request)
    }

    if (!session.userId) {
        return unauthorizedResponse(request)
    }

    if ((isSessionRegistryEnabled() || isSessionRegistryRequired()) && !session.sid) {
        return unauthorizedResponse(request)
    }

    if (isSessionPastAbsoluteMax(session)) {
        return unauthorizedResponse(request)
    }

    // Enforce 2FA: if user has 2FA enabled but hasn't completed it, redirect to login
    if (session.twoFactorVerified === false) {
        return unauthorizedResponse(request)
    }

    const refreshed = await updateSession(request)
    if (refreshed) return refreshed

    return NextResponse.next()
}

// Config to run middleware on all routes
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
