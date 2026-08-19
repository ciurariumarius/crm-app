import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getTickTickAuthUrl, isTickTickOAuthConfigured } from "@/lib/integrations/ticktick/auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const session = await getSession()
    const origin = new URL(request.url).origin
    if (!session || !session.userId) {
        return NextResponse.redirect(new URL("/login", request.url))
    }

    if (!isTickTickOAuthConfigured()) {
        const errorUrl = new URL("/settings", request.url)
        errorUrl.searchParams.set("ticktick_error", "oauth_not_configured")
        return NextResponse.redirect(errorUrl)
    }

    try {
        const authUrl = getTickTickAuthUrl(session.userId, origin)
        return NextResponse.redirect(authUrl)
    } catch (error) {
        const errorUrl = new URL("/settings", request.url)
        errorUrl.searchParams.set("ticktick_error", error instanceof Error ? error.message : "auth_error")
        return NextResponse.redirect(errorUrl)
    }
}
