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
import {
    BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN,
    PUBLIC_ASSET_PATH_SET,
} from './lib/security/public-assets'
import { buildContentSecurityPolicy } from './lib/security/csp'

const PUBLIC_PATHS = ['/login']
// Cron and OAuth callback routes perform their own cryptographic authentication.
const PUBLIC_API_PATHS = [
    '/api/cron/rollover',
    '/api/cron/lms-daily-admin-work',
    '/api/cron/notes-retention',
    '/api/cron/ticktick-sync',
    '/api/integrations/ticktick/callback',
    '/api/health',
]

runSecurityPreflight()

function applySecurityHeaders(response: NextResponse, csp: string, requestId: string) {
    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'same-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.headers.set('X-DNS-Prefetch-Control', 'on')
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    response.headers.set('X-Request-Id', requestId)
    return response
}

// Protected routes configuration
const isProtectedRoute = (path: string) => {
    if (PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`))) return false
    if (PUBLIC_API_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`))) return false

    if (path.startsWith('/_next') || PUBLIC_ASSET_PATH_SET.has(path)) return false

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
    const nonce = crypto.randomUUID().replaceAll('-', '')
    const requestId = request.headers.get('x-request-id')?.slice(0, 128) || crypto.randomUUID()
    const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development')
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('x-request-id', requestId)
    requestHeaders.set('Content-Security-Policy', csp)
    const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } })
    const secure = (response: NextResponse) => applySecurityHeaders(response, csp, requestId)

    if (BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN.test(pathname)) {
        return secure(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }

    // Ignore non-protected routes
    if (!isProtectedRoute(pathname)) {
        return secure(nextResponse())
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
        return secure(unauthorizedResponse(request))
    }

    // Verify session
    const session = await decrypt<SessionPayload>(sessionCookie)

    if (!session) {
        return secure(unauthorizedResponse(request))
    }

    if (!session.userId) {
        return secure(unauthorizedResponse(request))
    }

    if ((isSessionRegistryEnabled() || isSessionRegistryRequired()) && !session.sid) {
        return secure(unauthorizedResponse(request))
    }

    if (isSessionPastAbsoluteMax(session)) {
        return secure(unauthorizedResponse(request))
    }

    // Enforce 2FA: if user has 2FA enabled but hasn't completed it, redirect to login
    if (session.twoFactorVerified === false) {
        return secure(unauthorizedResponse(request))
    }

    const refreshed = await updateSession(request, requestHeaders)
    if (refreshed) return secure(refreshed)

    return secure(nextResponse())
}

// Config to run middleware on all routes
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
