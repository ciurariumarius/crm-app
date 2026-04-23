"use client"

import * as React from "react"
import { LaptopMinimal, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { ThemeMode } from "@/lib/theme"

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: LaptopMinimal },
]

export function ThemeDropdownItems({ withSeparator = true }: { withSeparator?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme: ThemeMode = mounted && (theme === "light" || theme === "dark" || theme === "system") ? theme : "system"

  return (
    <>
      {withSeparator ? <DropdownMenuSeparator /> : null}
      <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={activeTheme} onValueChange={(value) => setTheme(value as ThemeMode)}>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer">
              <Icon className="mr-2 h-4 w-4" />
              {option.label}
            </DropdownMenuRadioItem>
          )
        })}
      </DropdownMenuRadioGroup>
    </>
  )
}
