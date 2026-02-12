"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Database, Briefcase, CreditCard, Menu, BarChart3, CheckSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Vault", href: "/vault", icon: Database },
    { name: "Projects", href: "/projects", icon: Briefcase },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Services", href: "/services", icon: Briefcase },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <>
            {/* Mobile Sidebar */}
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-40">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                    <div className="flex flex-col h-full py-4">
                        <div className="px-2 mb-8">
                            <h1 className="text-xl font-bold tracking-tight">GTM/PPC CRM</h1>
                        </div>
                        <nav className="space-y-2 flex-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === item.href
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted"
                                        }`}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-auto space-y-2">
                            <ThemeToggle />
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col w-64 border-r bg-card h-screen fixed left-0 top-0 overflow-y-auto">
                <div className="p-6">
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Limitless CRM
                    </h1>
                </div>
                <Separator />
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isGroupActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

                        return (
                            <div key={item.name} className="space-y-1">
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${isGroupActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.name}
                                </Link>
                            </div>
                        )
                    })}
                </nav>
                <div className="p-4 space-y-3">
                    <ThemeToggle />
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                        <Avatar>
                            <AvatarImage src="/avatar.png" />
                            <AvatarFallback>ML</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-sm">
                            <span className="font-semibold">Marius</span>
                            <span className="text-xs text-muted-foreground">Pro Plan</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
