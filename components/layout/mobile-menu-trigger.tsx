"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useHeader } from "./header-context"

export function MobileMenuTrigger() {
    const { setIsMobileMenuOpen } = useHeader()

    return (
        <Button
            variant="ghost"
            size="icon"
            className="z-40 h-11 w-11 shrink-0 rounded-[28px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_95%,var(--surface-low)_5%)] text-[var(--text-secondary)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] hover:text-[var(--text-primary)] md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
        >
            <Menu className="h-5 w-5" />
        </Button>
    )
}
