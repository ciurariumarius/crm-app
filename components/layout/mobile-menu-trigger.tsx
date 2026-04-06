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
            className="z-40 h-11 w-11 shrink-0 rounded-[28px] border border-slate-200/90 bg-white/95 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
        >
            <Menu className="h-5 w-5" />
        </Button>
    )
}
