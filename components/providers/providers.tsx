"use client"

import * as React from "react"

import { TimerProvider } from "@/components/providers/timer-provider"

export function Providers({ children, initialActiveTimer }: { children: React.ReactNode, initialActiveTimer?: any }) {
    return (
        <TimerProvider initialActiveTimer={initialActiveTimer}>
            {children}
        </TimerProvider>
    )
}
