"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Database,
    Briefcase,
    CreditCard,
    Menu,
    BarChart3,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Circle,
    Clock
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export function Sidebar() {
    const pathname = usePathname()
    const [isVaultOpen, setIsVaultOpen] = useState(true)

    const navItems = [
        { name: "Overview", href: "/", icon: LayoutDashboard },
        { name: "Projects", href: "/projects", icon: Briefcase },
        { name: "Tasks", href: "/tasks", icon: CheckSquare },
        { name: "Time", href: "/time", icon: Clock },
    ]

    const vaultItems = [
        { name: "Partners", href: "/vault", icon: Briefcase },
        { name: "Sites", href: "/vault/sites", icon: Database },
        { name: "Services", href: "/services", icon: Briefcase },
    ]

    const renderLink = (item: any) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "group relative flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-300",
                    isActive
                        ? "text-foreground bg-primary/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
            >
                {isActive && <div className="sidebar-active-indicator" />}
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "opacity-40")} strokeWidth={1.5} />
                <span className={cn("tracking-tight transition-all", isActive ? "font-bold" : "font-medium opacity-60")}>
                    {item.name}
                </span>
            </Link>
        )
    }

    return (
        <>
            {/* Mobile Sidebar */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-40 bg-card border border-border">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] p-0 bg-background border-r border-border shadow-lg">
                    <div className="flex flex-col h-full py-6">
                        <div className="px-8 mb-10">
                            <h1 className="text-xl font-bold uppercase tracking-tight text-foreground">
                                Pixelist<span className="text-primary">.</span>
                            </h1>
                        </div>
                        <nav className="flex-1 space-y-1">
                            {navItems.map(renderLink)}
                            <div className="mt-8 mb-2 px-6">
                                <button
                                    onClick={() => setIsVaultOpen(!isVaultOpen)}
                                    className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >
                                    The Vault
                                    {isVaultOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                            </div>
                            {isVaultOpen && vaultItems.map(renderLink)}
                        </nav>
                        <div className="p-6 border-t border-border">
                            <ThemeToggle />
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col w-60 bg-card border-r border-border h-screen fixed left-0 top-0 overflow-y-auto z-50">
                <div className="py-10 px-8">
                    <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                        Pixelist<span className="text-primary">.</span>
                        <div className="h-1 w-1 rounded-full bg-primary" />
                    </h1>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map(renderLink)}

                    <div className="mt-10 mb-2 px-6">
                        <button
                            onClick={() => setIsVaultOpen(!isVaultOpen)}
                            className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                            THE VAULT
                            <div className="h-4 w-4 flex items-center justify-center rounded-lg hover:bg-muted/50">
                                {isVaultOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                            </div>
                        </button>
                    </div>

                    {isVaultOpen && (
                        <div className="animate-in slide-in-from-top-1 duration-300">
                            {vaultItems.map(renderLink)}
                        </div>
                    )}

                    <div className="mt-8">
                        {renderLink({ name: "Analytics", href: "/analytics", icon: BarChart3 })}
                    </div>
                </nav>

                <div className="p-6">
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-muted/30 group hover:bg-muted/50 transition-all">
                        <Avatar className="h-8 w-8 border border-border ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                            <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold uppercase">ML</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-sm">
                            <span className="font-bold text-xs tracking-tight text-foreground/80 group-hover:text-foreground transition-colors">Marius L.</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Ops Lead</span>
                                <Circle className="h-1 w-1 fill-emerald-500/40 text-transparent" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
