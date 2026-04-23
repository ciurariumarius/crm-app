"use client"

import * as React from "react"
import { LaptopMinimal, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import type { ThemeMode } from "@/lib/theme"

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: LaptopMinimal },
]

export function ThemeModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme: ThemeMode = mounted && (theme === "light" || theme === "dark" || theme === "system") ? theme : "system"

  return (
    <div className={cn("inline-flex items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)] p-1", className)}>
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon
        const isActive = option.value === activeTheme
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold transition-all",
              isActive
                ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_76%,transparent)]"
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
