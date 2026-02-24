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
    Clock,
    Search,
    Share2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


export function Sidebar() {
    const pathname = usePathname()
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null)
    const [isVaultOpen, setIsVaultOpen] = useState(true) // Keep for mobile
    const [isPPCOpen, setIsPPCOpen] = useState(true)     // Keep for mobile

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

    const ppcItems = [
        { name: "Google Ads", href: "/ppc/google-ads", icon: Search },
        { name: "Facebook Ads", href: "/ppc/facebook-ads", icon: Share2 },
    ]

    const renderRailItem = (item: any) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && item.href !== "/vault" && item.href !== "/ppc")
        return (
            <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setActiveDrawer(null)}
                className={cn(
                    "group relative flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                    isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={item.name}
            >
                <item.icon className="h-5 w-5" strokeWidth={1.5} />
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-primary shadow-[0_0_8px_rgba(13,148,136,0.4)]" />
                )}
            </Link>
        )
    }

    const renderMobileLink = (item: any) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "group relative flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-300 border-l-[3px]",
                    isActive
                        ? "text-foreground bg-primary/5 border-emerald-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                )}
            >
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
                            {navItems.map(renderMobileLink)}

                            <div className="mt-8 mb-2 px-6">
                                <button
                                    onClick={() => setIsVaultOpen(!isVaultOpen)}
                                    className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >
                                    The Vault
                                    {isVaultOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                            </div>
                            {isVaultOpen && vaultItems.map(renderMobileLink)}

                            <div className="mt-8 mb-2 px-6">
                                <button
                                    onClick={() => setIsPPCOpen(!isPPCOpen)}
                                    className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >
                                    PPC
                                    {isPPCOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                            </div>
                            {isPPCOpen && ppcItems.map(renderMobileLink)}
                        </nav>
                        <div className="p-6 border-t border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src="/avatar.png" alt="@marius" />
                                    <AvatarFallback>ML</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium leading-none">Marius Limitless</span>
                                    <span className="text-xs text-muted-foreground mt-1">marius@example.com</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop Rail + Drawer */}
            <div
                className="hidden md:flex fixed left-0 top-0 h-screen z-50 group isolate"
                onMouseLeave={() => setActiveDrawer(null)}
            >
                {/* Primary Rail */}
                <div className="w-[70px] bg-card border-r border-border h-full flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                        <span className="font-bold text-xl">P.</span>
                    </div>

                    <nav className="flex-1 flex flex-col items-center gap-4 w-full px-2">
                        {navItems.map(renderRailItem)}

                        <div className="h-px w-8 bg-border/50 my-2" />

                        {/* Vault Trigger */}
                        <Link
                            href="/vault"
                            onMouseEnter={() => setActiveDrawer('vault')}
                            className={cn(
                                "group relative flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                                pathname.startsWith("/vault") || activeDrawer === 'vault'
                                    ? "bg-indigo-500/10 text-indigo-500"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <Database className="h-5 w-5" strokeWidth={1.5} />
                            {(pathname.startsWith("/vault") || activeDrawer === 'vault') && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                            )}
                        </Link>

                        {/* PPC Trigger */}
                        <Link
                            href="/ppc/google-ads"
                            onMouseEnter={() => setActiveDrawer('ppc')}
                            className={cn(
                                "group relative flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                                pathname.startsWith("/ppc") || activeDrawer === 'ppc'
                                    ? "bg-rose-500/10 text-rose-500"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <Share2 className="h-5 w-5" strokeWidth={1.5} />
                            {(pathname.startsWith("/ppc") || activeDrawer === 'ppc') && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                            )}
                        </Link>

                        <div className="h-px w-8 bg-border/50 my-2" />

                        <Link
                            href="/analytics"
                            onMouseEnter={() => setActiveDrawer(null)}
                            className={cn(
                                "group relative flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                                pathname === "/analytics"
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
                        </Link>

                    </nav>

                    <div className="mt-auto flex flex-col items-center gap-4 pb-4">

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Avatar className="h-8 w-8 border border-border cursor-pointer hover:ring-2 ring-primary/20 transition-all">
                                    <AvatarImage src="/avatar.png" alt="@marius" />
                                    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">ML</AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={20} forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">Marius Limitless</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            marius@example.com
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>Profile</DropdownMenuItem>
                                <DropdownMenuItem>Billing</DropdownMenuItem>
                                <DropdownMenuItem>Settings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-rose-500">Log out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Context Drawer */}
                <div className={cn(
                    "w-64 bg-background/95 backdrop-blur-xl border-r border-border h-full absolute left-[65px] top-0 z-10 transition-all duration-300 ease-[cubic-bezier(0.2,0.0,0.2,1)] shadow-2xl pl-2",
                    activeDrawer ? "translate-x-0 opacity-100" : "-translate-x-[20px] opacity-0 pointer-events-none"
                )}>
                    <div className="h-full flex flex-col py-8 px-6">
                        {activeDrawer === 'vault' && (
                            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                                    <Database className="h-3 w-3" />
                                    The Vault
                                </h3>
                                <nav className="space-y-1">
                                    {vaultItems.map(item => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "block px-4 py-2.5 rounded-lg text-sm transition-colors",
                                                pathname === item.href
                                                    ? "bg-indigo-500/10 text-indigo-600 font-medium"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {activeDrawer === 'ppc' && (
                            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                                    <Share2 className="h-3 w-3" />
                                    Campaigns
                                </h3>
                                <nav className="space-y-1">
                                    {ppcItems.map(item => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "block px-4 py-2.5 rounded-lg text-sm transition-colors",
                                                pathname === item.href
                                                    ? "bg-rose-500/10 text-rose-600 font-medium"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {/* Empty/Loading State Protection */}
                        {!activeDrawer && (
                            <div className="h-full flex items-center justify-center opacity-0"></div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
