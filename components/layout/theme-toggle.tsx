"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3 px-3 py-2.5 h-auto font-medium"
                disabled
            >
                <Sun className="h-4 w-4" />
                <span className="text-sm">Theme</span>
            </Button>
        )
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full justify-start gap-3 px-3 py-2.5 h-auto font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
        >
            {theme === "dark" ? (
                <>
                    <Sun className="h-4 w-4" />
                    <span className="text-sm">Light Mode</span>
                </>
            ) : (
                <>
                    <Moon className="h-4 w-4" />
                    <span className="text-sm">Dark Mode</span>
                </>
            )}
        </Button>
    )
}
