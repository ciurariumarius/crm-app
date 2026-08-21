"use client"

import * as React from "react"
import { Share, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const IOS_INSTALL_HINT_DISMISSED_KEY = "pixelist.ios-install-hint.dismissed.v1"

type StandaloneNavigator = Navigator & {
    standalone?: boolean
}

function isIphoneSafari() {
    const userAgent = window.navigator.userAgent
    const isIphone = /iPhone|iPod/i.test(userAgent)
    const isSafari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent)
    return isIphone && isSafari
}

function isStandalone() {
    const navigatorWithStandalone = window.navigator as StandaloneNavigator
    return navigatorWithStandalone.standalone === true
        || window.matchMedia("(display-mode: standalone)").matches
}

export function IosInstallHint() {
    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
        if (!isIphoneSafari() || isStandalone()) return

        try {
            if (window.localStorage.getItem(IOS_INSTALL_HINT_DISMISSED_KEY) === "1") return
        } catch {
            // Show the hint when storage is unavailable; dismissal still works for this session.
        }

        const timer = window.setTimeout(() => setIsVisible(true), 1200)
        return () => window.clearTimeout(timer)
    }, [])

    const dismiss = React.useCallback(() => {
        setIsVisible(false)
        try {
            window.localStorage.setItem(IOS_INSTALL_HINT_DISMISSED_KEY, "1")
        } catch {
            // The local state still dismisses the current hint.
        }
    }, [])

    if (!isVisible) return null

    return (
        <aside
            role="status"
            aria-live="polite"
            className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] items-start gap-3 rounded-2xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,transparent)] p-3.5 text-[var(--text-primary)] shadow-[var(--shadow-apple)] backdrop-blur-xl md:hidden"
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--primary)]">
                <Share className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold">Use Pixelist fullscreen</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                    Tap Share, then Add to Home Screen.
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="mt-1.5 h-8 px-2 text-xs">
                    Got it
                </Button>
            </div>
            <button
                type="button"
                onClick={dismiss}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                aria-label="Dismiss fullscreen install hint"
            >
                <X className="h-4 w-4" />
            </button>
        </aside>
    )
}
