import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt, SESSION_COOKIE_NAME } from './lib/auth'

// Protected routes configuration
const isProtectedRoute = (path: string) => {
    // Everything is protected except /login, /api/auth, and public assets
    const publicPaths = ['/login', '/manifest.json', '/sw.js']
    if (publicPaths.some(p => path.startsWith(p))) return false

    // Allow static assets, images, icons, next build files
    if (path.startsWith('/_next') || path.startsWith('/icons') || path.match(/\.(ico|png|svg|jpg)$/)) return false

    return true
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Ignore non-protected routes
    if (!isProtectedRoute(pathname)) {
        return NextResponse.next()
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verify session
    const session = await decrypt(sessionCookie)

    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Handle 2FA requirement. 
    // If they have 2FA enabled, but it's not verified in this session, 
    // we need to bounce them to a 2FA prompt page (we will handle this within /login flow usually, but we can do a check here if we want)
    // For now, if the auth is valid, let them in. The login flow itself will ensure twoFactorVerified is true.

    return NextResponse.next()
}

// Config to run middleware on all routes
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
