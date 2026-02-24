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
            className="md:hidden bg-card border border-border shrink-0 z-40"
            onClick={() => setIsMobileMenuOpen(true)}
        >
            <Menu className="h-6 w-6" />
        </Button>
    )
}
