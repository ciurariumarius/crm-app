"use client"

import * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { TimerProvider } from "@/components/providers/timer-provider"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
        >
            <TimerProvider>
                {children}
            </TimerProvider>
        </ThemeProvider>
    )
}
