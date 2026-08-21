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
            className="z-40 h-11 w-11 shrink-0 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-[var(--shadow-apple)] transition-colors hover:border-[var(--brand-primary)] hover:bg-[var(--surface-low)] hover:text-[var(--brand-primary)] md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
        >
            <Menu className="h-5 w-5" />
        </Button>
    )
}
