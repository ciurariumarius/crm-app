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
  Database,
  Globe,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  UserPlus,
  Users,
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

const coreNav: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutGrid },
  { name: "Projects", href: "/projects", icon: Package },
  { name: "Tasks", href: "/tasks", icon: CheckCircle },
  { name: "Payments", href: "/payments", icon: CreditCard },
]

const databaseNav: NavItem[] = [
  { name: "Services", href: "/services", icon: Package },
  { name: "Domains", href: "/domains", icon: Globe },
  { name: "Time Logs", href: "/time", icon: Clock },
  { name: "Partners", href: "/partners", icon: Users },
]

const ppcNav: NavItem[] = [
  { name: "Google Ads", href: "/ppc/google-ads", icon: UserPlus },
  { name: "Facebook Ads", href: "/ppc/facebook-ads", icon: UserPlus },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ user }: { user?: { name: string | null, username: string, profilePic: string | null } }) {
  const pathname = usePathname()
  const { isMobileMenuOpen, setIsMobileMenuOpen, isSidebarCollapsed, setIsSidebarCollapsed } = useHeader()
  const asideRef = useRef<HTMLElement | null>(null)
  const [isSidebarFocusExpanded, setIsSidebarFocusExpanded] = useState(false)
  const [databaseOpen, setDatabaseOpen] = useState(true)
  const [ppcOpen, setPpcOpen] = useState(true)

  const isDesktopCollapsed = isSidebarCollapsed && !isSidebarFocusExpanded
  const isDatabaseActive = databaseNav.some((item) => isActivePath(pathname, item.href))
  const isPpcActive = ppcNav.some((item) => isActivePath(pathname, item.href))
  const showDatabaseChildren = databaseOpen || isDatabaseActive
  const showPpcChildren = ppcOpen || isPpcActive
  const displayName = user?.name || user?.username || "Admin"
  const displayRole = "Admin"
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

  const renderDesktopItem = (item: NavItem) => {
    const isActive = isActivePath(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        title={isDesktopCollapsed ? item.name : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-[10px] border border-transparent px-3 py-2.5 text-[14px] font-medium transition-colors",
          isDesktopCollapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--line-subtle)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-primary)]"
        )}
      >
        {isActive ? (
          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--brand-cyan)]" />
        ) : null}
        <item.icon className={cn("h-[16px] w-[16px] shrink-0")} strokeWidth={1.8} />
        {!isDesktopCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    )
  }

  const renderMobileItem = (item: NavItem) => {
    const isActive = isActivePath(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={cn(
          "group relative flex items-center gap-3 rounded-[10px] border border-transparent px-4 py-3 text-[14px] font-medium transition-colors",
          isActive
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--line-subtle)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-primary)]"
        )}
      >
        {isActive ? (
          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--brand-cyan)]" />
        ) : null}
        <item.icon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.8} />
        <span className="truncate">{item.name}</span>
      </Link>
    )
  }

  const renderDesktopGroup = (
    label: string,
    icon: ComponentType<{ className?: string; strokeWidth?: number }>,
    expanded: boolean,
    isActive: boolean,
    onToggle: () => void,
    items: NavItem[]
  ) => {
    const GroupIcon = icon
    return (
      <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-[10px] border border-transparent px-3 py-2.5 text-[14px] font-medium transition-colors",
          isDesktopCollapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--line-subtle)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-primary)]"
        )}
        title={isDesktopCollapsed ? label : undefined}
      >
        {isActive ? (
          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--brand-cyan)]" />
        ) : null}
        {isDesktopCollapsed ? (
          <GroupIcon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.8} />
        ) : (
          <>
            <GroupIcon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.8} />
            <span className="truncate">{label}</span>
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </>
        )}
      </button>
      {!isDesktopCollapsed && expanded ? (
        <div className="space-y-1 pl-3">{items.map(renderDesktopItem)}</div>
      ) : null}
      {isDesktopCollapsed && isActive ? <div className="space-y-1">{items.map(renderDesktopItem)}</div> : null}
      </div>
    )
  }

  const renderMobileGroup = (
    label: string,
    icon: ComponentType<{ className?: string; strokeWidth?: number }>,
    expanded: boolean,
    isActive: boolean,
    onToggle: () => void,
    items: NavItem[]
  ) => {
    const GroupIcon = icon
    return (
      <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-[10px] border border-transparent px-4 py-3 text-[14px] font-medium transition-colors",
          isActive
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--line-subtle)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-primary)]"
        )}
      >
        {isActive ? (
          <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[var(--brand-cyan)]" />
        ) : null}
        <GroupIcon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.8} />
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? <div className="space-y-1 pl-3">{items.map(renderMobileItem)}</div> : null}
      </div>
    )
  }

  return (
    <>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[292px] border-r border-[var(--line-subtle)] bg-[var(--bg-sidebar)] p-0 shadow-[var(--shadow-apple)]">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>

          <div className="flex h-full flex-col overflow-y-auto">
            <div className="border-b border-[var(--line-subtle)] px-5 py-5">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,var(--brand-primary-strong),var(--brand-cyan))] text-white shadow-[var(--shadow-apple)]">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h1 className="text-[31px] font-bold tracking-[-0.03em] text-[var(--text-primary)] leading-none">Pixelist</h1>
                </div>
              </Link>
            </div>

            <nav className="flex-1 space-y-5 px-3 py-5">
              <div className="space-y-1">{coreNav.map(renderMobileItem)}</div>
              <div className="h-px bg-[var(--line-subtle)]" />
              {renderMobileGroup("Database", Database, showDatabaseChildren, isDatabaseActive, () => setDatabaseOpen((prev) => !prev), databaseNav)}
              {renderMobileGroup("PPC", BarChart3, showPpcChildren, isPpcActive, () => setPpcOpen((prev) => !prev), ppcNav)}
            </nav>

            <div className="mt-auto border-t border-[var(--line-subtle)] px-3 py-4 space-y-2">
              {renderMobileItem({ name: "Settings", href: "/settings", icon: Settings })}
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{displayName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{displayRole}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 rounded-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <aside
        ref={asideRef}
        onFocusCapture={handleDesktopFocusCapture}
        onBlurCapture={handleDesktopBlurCapture}
        className={cn(
          "fixed left-0 top-0 z-50 hidden h-screen border-r border-[var(--line-subtle)] bg-[var(--bg-sidebar)] md:flex transition-[width] duration-300",
          isDesktopCollapsed ? "w-[92px]" : "w-[236px]"
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
          className="absolute -right-3 top-8 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-apple)] transition-colors hover:text-[var(--text-primary)]"
          aria-label={isDesktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isDesktopCollapsed}
          aria-controls="desktop-sidebar-nav"
        >
          {isDesktopCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        <div className="flex h-full w-full flex-col px-3 py-4">
          <div className={cn("border-b border-[var(--line-subtle)] pb-4", isDesktopCollapsed ? "flex justify-center" : "px-2")}>
            <Link href="/" className={cn("inline-flex items-center gap-3", isDesktopCollapsed && "justify-center")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,var(--brand-primary-strong),var(--brand-cyan))] text-white shadow-[var(--shadow-apple)]">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              {!isDesktopCollapsed ? (
                <div>
                  <h1 className="text-[31px] font-bold tracking-[-0.03em] text-[var(--text-primary)] leading-none">Pixelist</h1>
                </div>
              ) : null}
            </Link>
          </div>

          <nav id="desktop-sidebar-nav" className="mt-4 flex-1 space-y-5">
            <div className="space-y-1">{coreNav.map(renderDesktopItem)}</div>
            <div className="mx-2 h-px bg-[var(--line-subtle)]" />
            {renderDesktopGroup("Database", Database, showDatabaseChildren, isDatabaseActive, () => setDatabaseOpen((prev) => !prev), databaseNav)}
            {renderDesktopGroup("PPC", BarChart3, showPpcChildren, isPpcActive, () => setPpcOpen((prev) => !prev), ppcNav)}
          </nav>

          <div className="mt-auto space-y-2">
            {renderDesktopItem({ name: "Settings", href: "/settings", icon: Settings })}

            {!isDesktopCollapsed ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-[var(--shadow-apple)]">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profilePic || "/avatar.png"} alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{displayName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{displayRole}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 rounded-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--line-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-apple)]"
                      aria-label="Account menu"
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
                      <p className="mt-1 text-xs text-muted-foreground">{displayRole}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
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
