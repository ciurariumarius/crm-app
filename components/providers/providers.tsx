"use client"

import * as React from "react"

import { TimerProvider } from "@/components/providers/timer-provider"
import type { InitialActiveTimer } from "@/components/providers/timer-provider"

export function Providers({
    children,
    initialActiveTimer
}: {
    children: React.ReactNode
    initialActiveTimer?: InitialActiveTimer | null
}) {
    return (
        <TimerProvider initialActiveTimer={initialActiveTimer}>
            {children}
        </TimerProvider>
    )
}
