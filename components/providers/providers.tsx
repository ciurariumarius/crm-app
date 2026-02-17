"use client"

import * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { TimerProvider } from "@/components/providers/timer-provider"

export function Providers({ children, initialActiveTimer }: { children: React.ReactNode, initialActiveTimer?: any }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
        >
            <TimerProvider initialActiveTimer={initialActiveTimer}>
                {children}
            </TimerProvider>
        </ThemeProvider>
    )
}
