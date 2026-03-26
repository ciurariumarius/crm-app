"use client"

import * as React from "react"

import { TimerProvider } from "@/components/providers/timer-provider"
import type { InitialActiveTimer } from "@/components/providers/timer-provider"
import type { TimerPreferences } from "@/components/providers/timer-provider"

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
        <TimerProvider initialActiveTimer={initialActiveTimer} preferences={timerPreferences}>
            {children}
        </TimerProvider>
    )
}
