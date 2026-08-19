import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { exchangeTickTickCode, extractUserIdFromOAuthState } from "@/lib/integrations/ticktick/auth"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    const settingsUrl = new URL("/settings", request.url)

    if (error) {
        logger.error("[ticktick-callback] OAuth error from provider", { error })
        settingsUrl.searchParams.set("ticktick_error", error)
        return NextResponse.redirect(settingsUrl)
    }

    if (!code || !state) {
        settingsUrl.searchParams.set("ticktick_error", "missing_code_or_state")
        return NextResponse.redirect(settingsUrl)
    }

    const session = await getSession()
    const userIdFromState = extractUserIdFromOAuthState(state)
    const targetUserId = session?.userId || userIdFromState

    if (!targetUserId) {
        settingsUrl.searchParams.set("ticktick_error", "invalid_or_expired_state")
        return NextResponse.redirect(settingsUrl)
    }

    const origin = new URL(request.url).origin
    const result = await exchangeTickTickCode(code, state, targetUserId, origin)

    if (!result.success) {
        settingsUrl.searchParams.set("ticktick_error", result.error || "exchange_failed")
        return NextResponse.redirect(settingsUrl)
    }

    settingsUrl.searchParams.set("ticktick_connected", "1")
    return NextResponse.redirect(settingsUrl)
}
