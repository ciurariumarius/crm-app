"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"

import { TimerProvider } from "@/components/providers/timer-provider"
import type { InitialActiveTimer } from "@/components/providers/timer-provider"
import type { TimerPreferences } from "@/components/providers/timer-provider"
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY } from "@/lib/theme"

export function Providers({
    children,
    initialActiveTimer,
    timerPreferences
}: {
    children: React.ReactNode
    initialActiveTimer?: InitialActiveTimer | null
    timerPreferences?: TimerPreferences | null
}) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={DEFAULT_THEME_MODE}
            enableSystem
            storageKey={THEME_STORAGE_KEY}
            disableTransitionOnChange
            enableColorScheme
        >
            <TimerProvider initialActiveTimer={initialActiveTimer} preferences={timerPreferences}>
                {children}
            </TimerProvider>
        </ThemeProvider>
    )
}
