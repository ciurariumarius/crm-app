"use client"

import { useRef, useState, type ComponentType, type FocusEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useHeader } from "./header-context"
import { logoutUser } from "@/lib/actions/auth"
import {
    BarChart3,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    Globe,
    LayoutGrid,
    LogOut,
    Package,
    Search,
    Settings,
    Users,
    UserPlus,
    Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type NavItem = {
    name: string
    href: string
    icon: ComponentType<{ className?: string; strokeWidth?: number }>
}

const primaryNav: NavItem[] = [
    { name: "Overview", href: "/", icon: LayoutGrid },
    { name: "Projects", href: "/projects", icon: Package },
    { name: "Tasks", href: "/tasks", icon: CheckCircle },
]

const dataNav: NavItem[] = [
    { name: "Partners", href: "/partners", icon: Users },
    { name: "Domains", href: "/domains", icon: Globe },
    { name: "Services", href: "/services", icon: Package },
    { name: "Time Logs", href: "/time", icon: Clock },
    { name: "Payment Log", href: "/payments", icon: CreditCard },
]

const ppcNav: NavItem[] = [
    { name: "Google Ads", href: "/ppc/google-ads", icon: Search },
    { name: "Facebook Ads", href: "/ppc/facebook-ads", icon: UserPlus },
]

const utilityNav: NavItem[] = [
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
]

function isActivePath(pathname: string, href: string) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ user }: { user?: { name: string | null, username: string, profilePic: string | null } }) {
    const pathname = usePathname()
    const {
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
    } = useHeader()
    const asideRef = useRef<HTMLElement | null>(null)
    const [isDataOpen, setIsDataOpen] = useState(true)
    const [isPPCOpen, setIsPPCOpen] = useState(true)
    const [isSidebarFocusExpanded, setIsSidebarFocusExpanded] = useState(false)
    const isDesktopCollapsed = isSidebarCollapsed && !isSidebarFocusExpanded
    const collapseButtonLabel = isSidebarCollapsed
        ? (isDesktopCollapsed ? "Expand sidebar" : "Keep sidebar expanded")
        : "Collapse sidebar"

    const displayName = user?.name || user?.username || "Admin"
    const displayRole = "Owner"
    const initials = displayName.substring(0, 2).toUpperCase()

    const handleLogout = async () => {
        await logoutUser()
        window.location.href = "/login"
    }

    const handleDesktopFocusCapture = () => {
        if (!isSidebarCollapsed) return
        setIsSidebarFocusExpanded(true)
    }

    const handleDesktopBlurCapture = (event: FocusEvent<HTMLElement>) => {
        if (!isSidebarCollapsed) return
        const nextFocused = event.relatedTarget as Node | null
        if (nextFocused && asideRef.current?.contains(nextFocused)) return
        setIsSidebarFocusExpanded(false)
    }

    const renderDesktopItem = (item: NavItem, options?: { nested?: boolean }) => {
        const isActive = isActivePath(pathname, item.href)
        const nested = options?.nested ?? false
        return (
            <Link
                key={item.href}
                href={item.href}
                title={isDesktopCollapsed ? item.name : undefined}
                className={cn(
                    "group relative flex items-center gap-3 rounded-xl transition-all duration-200 px-3 py-2.5",
                    isDesktopCollapsed && "justify-center px-0",
                    isActive
                        ? "bg-blue-50/70 text-blue-600 shadow-none border border-blue-100/50"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                )}
            >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700")} strokeWidth={isActive ? 2 : 1.5} />
                {!isDesktopCollapsed && (
                    <span className={cn(
                        "text-[14px]",
                        nested ? "font-medium" : "font-medium tracking-tight",
                    )}>
                        {item.name}
                    </span>
                )}
            </Link>
        )
    }

    const renderMobileItem = (item: NavItem, options?: { nested?: boolean }) => {
        const isActive = isActivePath(pathname, item.href)
        const nested = options?.nested ?? false
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                    "group relative flex items-center gap-3 rounded-xl transition-all duration-200",
                    nested ? "px-10 py-2.5" : "px-6 py-3",
                    isActive
                        ? "bg-blue-50/70 text-blue-600 shadow-none border border-blue-100/50"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                )}
            >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700")} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn("text-sm font-medium tracking-tight")}>
                    {item.name}
                </span>
            </Link>
        )
    }

    return (
        <>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="w-[290px] p-0 glass text-sidebar-foreground border-r border-sidebar-border shadow-lg">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Navigation Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex h-full flex-col overflow-y-auto py-6">
                        <div className="px-6 pb-6 border-b border-sidebar-border">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
                                    <Zap className="h-5 w-5 fill-current" />
                                </div>
                                <div>
                                    <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Pixelist</h1>
                                </div>
                            </div>
                        </div>

                        <nav className="flex-1 px-4 py-6 space-y-1">
                            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Management</p>
                            {primaryNav.map((item) => renderMobileItem(item))}
                            <div className="my-4 h-px w-4/5 mx-auto bg-slate-300" />
                            <div className="pt-1">
                                <button
                                    onClick={() => setIsDataOpen((prev) => !prev)}
                                    aria-expanded={isDataOpen}
                                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"
                                >
                                    <span>Data</span>
                                    {isDataOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                                {isDataOpen && (
                                    <div className="mt-1 space-y-1">
                                        {dataNav.map((item) => renderMobileItem(item, { nested: true }))}
                                    </div>
                                )}
                            </div>
                            <div className="pt-3">
                                <button
                                    onClick={() => setIsPPCOpen((prev) => !prev)}
                                    aria-expanded={isPPCOpen}
                                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400"
                                >
                                    <span>PPC</span>
                                    {isPPCOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                                {isPPCOpen && (
                                    <div className="mt-1 space-y-1">
                                        {ppcNav.map((item) => renderMobileItem(item, { nested: true }))}
                                    </div>
                                )}
                            </div>
                            <div className="pt-3 space-y-1">
                                {utilityNav.map((item) => renderMobileItem(item))}
                            </div>
                        </nav>

                        <div className="mt-auto px-6 pt-4 border-t border-sidebar-border flex items-center justify-between">
                            <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate text-slate-900">{displayName}</p>
                                    <p className="text-xs text-slate-400">{displayRole}</p>
                                </div>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50" aria-label="Log out">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <aside
                ref={asideRef}
                onFocusCapture={handleDesktopFocusCapture}
                onBlurCapture={handleDesktopBlurCapture}
                className={cn(
                    "hidden md:flex fixed left-0 top-0 z-50 h-screen border-r border-sidebar-border glass transition-[width] duration-300",
                    isDesktopCollapsed ? "w-[88px]" : "w-[220px]"
                )}
            >
                <button
                    type="button"
                    onClick={() => {
                        if (isSidebarCollapsed) {
                            setIsSidebarCollapsed(false)
                            setIsSidebarFocusExpanded(false)
                            return
                        }
                        setIsSidebarCollapsed(true)
                    }}
                    className="absolute -right-3 top-10 h-6 w-6 rounded-full border border-sidebar-border bg-white text-slate-500 hover:text-slate-900 shadow-sm flex items-center justify-center"
                    aria-label={collapseButtonLabel}
                    aria-expanded={!isDesktopCollapsed}
                    aria-controls="desktop-sidebar-nav"
                >
                    {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
                </button>

                <div className="flex h-full w-full flex-col px-3 py-5">
                    <div className={cn("flex items-center", isDesktopCollapsed ? "justify-center" : "justify-start px-2")}>
                        <Link href="/" className={cn("inline-flex items-center gap-3", isDesktopCollapsed && "justify-center")}>
                            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
                                <Zap className="h-[22px] w-[22px] fill-current" />
                            </div>
                            {!isDesktopCollapsed && <span className="text-[27px] font-bold tracking-tight text-slate-900 leading-none">Pixelist</span>}
                        </Link>
                    </div>

                    <nav id="desktop-sidebar-nav" className="mt-8 flex-1 space-y-1">
                        {!isDesktopCollapsed && <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Management</p>}
                        {primaryNav.map((item) => renderDesktopItem(item))}

                        <button
                            type="button"
                            onClick={() => setIsDataOpen((prev) => !prev)}
                            aria-expanded={isDataOpen}
                            aria-controls="desktop-data-nav"
                            aria-label="Toggle Data section"
                            className={cn(
                                "w-full flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400",
                                isDesktopCollapsed ? "justify-center px-0 py-2" : "justify-between px-3 py-1"
                            )}
                        >
                            {isDesktopCollapsed ? (
                                <span className="inline-flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {isDataOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </span>
                            ) : (
                                <>
                                    <span>Data</span>
                                    {isDataOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </>
                            )}
                        </button>
                        {isDataOpen && (
                            <div id="desktop-data-nav" className="space-y-1">
                                {dataNav.map((item) => renderDesktopItem(item, { nested: !isDesktopCollapsed }))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsPPCOpen((prev) => !prev)}
                            aria-expanded={isPPCOpen}
                            aria-controls="desktop-ppc-nav"
                            aria-label="Toggle PPC section"
                            className={cn(
                                "mt-2 w-full flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400",
                                isDesktopCollapsed ? "justify-center px-0 py-2" : "justify-between px-3 py-1"
                            )}
                        >
                            {isDesktopCollapsed ? (
                                <span className="inline-flex items-center gap-1">
                                    <Search className="h-3.5 w-3.5" />
                                    {isPPCOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </span>
                            ) : (
                                <>
                                    <span>PPC</span>
                                    {isPPCOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </>
                            )}
                        </button>
                        {isPPCOpen && (
                            <div id="desktop-ppc-nav" className="space-y-1">
                                {ppcNav.map((item) => renderDesktopItem(item, { nested: !isDesktopCollapsed }))}
                            </div>
                        )}

                        {utilityNav.map((item) => renderDesktopItem(item))}
                    </nav>

                    <div className="mt-auto">
                        {!isDesktopCollapsed ? (
                            <div className="rounded-xl border border-sidebar-border bg-white p-3 flex items-center gap-3">
                                <Link href="/settings" className="flex items-center gap-3 min-w-0 flex-1">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate text-slate-900">{displayName}</p>
                                        <p className="text-xs text-slate-400">{displayRole}</p>
                                    </div>
                                </Link>
                                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50" aria-label="Log out">
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="h-10 w-10 rounded-xl border border-sidebar-border bg-white flex items-center justify-center hover:bg-slate-100 transition-colors"
                                            aria-label="Open account menu"
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                                                <AvatarFallback>{initials}</AvatarFallback>
                                            </Avatar>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="right" className="w-56">
                                        <DropdownMenuLabel className="font-normal">
                                            <p className="text-sm font-semibold leading-none">{displayName}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{displayRole}</p>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <Link href="/settings" className="cursor-pointer w-full"><Settings className="h-4 w-4 mr-2" />Settings</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-600">
                                            <LogOut className="h-4 w-4 mr-2" />Log out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    )
}
