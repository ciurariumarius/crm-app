"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useHeader } from "./header-context"
import { logoutUser } from "@/lib/actions/auth"
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
    Share2,
    LogOut
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


export function Sidebar({ user }: { user?: { name: string | null, username: string, profilePic: string | null } }) {
    const pathname = usePathname()
    const router = useRouter()
    const { isMobileMenuOpen, setIsMobileMenuOpen } = useHeader()
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null)
    const [isVaultOpen, setIsVaultOpen] = useState(true)
    const [isPPCOpen, setIsPPCOpen] = useState(true)

    const displayName = user?.name || user?.username || "Admin User"
    const displayEmail = user?.username ? `@${user.username}` : "admin@example.com"
    const initials = displayName.substring(0, 2).toUpperCase()

    const handleLogout = async () => {
        await logoutUser()
        window.location.href = "/login"
    }

    const navItems = [
        { name: "Overview", href: "/", icon: LayoutDashboard },
        { name: "Projects", href: "/projects", icon: Briefcase },
        { name: "Tasks", href: "/tasks", icon: CheckSquare },
    ]

    const vaultItems = [
        { name: "Partners", href: "/vault", icon: Briefcase },
        { name: "Sites", href: "/vault/sites", icon: Database },
        { name: "Services", href: "/services", icon: Briefcase },
        { name: "Time Logs", href: "/time", icon: Clock },
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
            >
                <item.icon className="h-5 w-5" strokeWidth={1.5} />
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-primary shadow-[0_0_8px_rgba(13,148,136,0.4)]" />
                )}
                {!activeDrawer && (
                    <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-md shadow-lg opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap">
                        {item.name}
                    </div>
                )}
            </Link>
        )
    }

    const handleMobileNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        // Prevent default link behavior
        e.preventDefault()
        // Close the menu immediately to trigger animation
        setIsMobileMenuOpen(false)
        // Wait for sheet slide-out animation to finish (approx 300ms) before navigating
        setTimeout(() => {
            router.push(href)
        }, 300)
    }

    const renderMobileLink = (item: any) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleMobileNav(e, item.href)}
                className={cn(
                    "group relative flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-300 border-l-[3px]",
                    isActive
                        ? "text-foreground bg-primary/5 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                )}
            >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "opacity-40")} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn("tracking-tight transition-all", isActive ? "font-bold" : "font-semibold opacity-80")}>
                    {item.name}
                </span>
            </Link>
        )
    }

    return (
        <>
            {/* Mobile Sidebar */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="w-[280px] p-0 bg-background border-r border-border shadow-lg">
                    <div className="flex flex-col h-full py-6 overflow-y-auto">
                        <div className="px-8 mb-10 shrink-0">
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
                        <div className="p-6 border-t border-border flex items-center justify-between shrink-0">
                            <Link href="/settings" onClick={(e) => handleMobileNav(e, "/settings")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium leading-none">{displayName}</span>
                                    <span className="text-xs text-muted-foreground mt-1">{displayEmail}</span>
                                </div>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-rose-500 rounded-full">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop Rail + Drawer */}
            <div
                className="hidden md:flex fixed left-0 top-0 h-screen z-50 group isolate"
                onMouseLeave={() => setActiveDrawer(null)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setActiveDrawer(null)
                }}
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
                            {!activeDrawer && (
                                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-md shadow-lg opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap">
                                    The Vault
                                </div>
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
                            {!activeDrawer && (
                                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-md shadow-lg opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap">
                                    Campaigns
                                </div>
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
                            {!activeDrawer && (
                                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-md shadow-lg opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap">
                                    Analytics
                                </div>
                            )}
                        </Link>

                    </nav>

                    <div className="mt-auto flex flex-col items-center gap-4 pb-4">

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Avatar className="h-8 w-8 border border-border cursor-pointer hover:ring-2 ring-primary/20 transition-all">
                                    <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                                    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{initials}</AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={20} forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{displayName}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {displayEmail}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/settings" className="cursor-pointer w-full">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-rose-500 cursor-pointer">
                                    Log out
                                </DropdownMenuItem>
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
